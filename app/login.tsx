import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import type { GoogleAuthRequestConfig } from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { auth, db } from '@/lib/firebase';
import { ensureUserProfile, touchLastLogin } from '@/lib/user-profile';
import { doc, getDoc } from 'firebase/firestore';

WebBrowser.maybeCompleteAuthSession();

const PRIMARY = '#039EA2';

type Extra = {
  googleAuth?: {
    androidClientId?: string;
    iosClientId?: string;
    webClientId?: string;
  };
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const extra = (Constants.expoConfig?.extra as Extra | undefined) ?? {};
  const googleIds = (extra.googleAuth ?? {}) as {
    androidClientId?: string;
    iosClientId?: string;
    webClientId?: string;
  };

  const appScheme = useMemo(() => {
    const rawScheme = Constants.expoConfig?.scheme;
    if (Array.isArray(rawScheme)) {
      return rawScheme[0] ?? 'disconnect';
    }
    return rawScheme ?? 'disconnect';
  }, []);

  const nativeRedirect = useMemo(() => {
    const transformClientId = (id?: string, suffix?: string) => {
      if (!id) return undefined;
      const [base] = id.split('.apps.googleusercontent.com');
      if (!base) return undefined;
      return `com.googleusercontent.apps.${base}${suffix ?? ''}`;
    };
    if (Platform.OS === 'android' && googleIds.androidClientId) {
      return transformClientId(googleIds.androidClientId, ':/oauth2redirect');
    }
    if (Platform.OS === 'ios' && googleIds.iosClientId) {
      return transformClientId(googleIds.iosClientId, ':/oauthredirect');
    }
    return undefined;
  }, [googleIds.androidClientId, googleIds.iosClientId]);

  const redirectUri = useMemo(
    () =>
      makeRedirectUri({
        scheme: appScheme,
        native: nativeRedirect,
      }),
    [appScheme, nativeRedirect]
  );

  useEffect(() => {
    console.log('[Auth][Google] config', {
      appScheme,
      nativeRedirect,
      redirectUri,
      clientIds: googleIds,
      platform: Platform.OS,
    });
  }, [appScheme, nativeRedirect, redirectUri, googleIds]);

  const clientId = useMemo<string>(() => {
    if (Platform.OS === 'android') return String(googleIds.androidClientId ?? googleIds.webClientId ?? '');
    if (Platform.OS === 'ios') return String(googleIds.iosClientId ?? googleIds.webClientId ?? '');
    return String(googleIds.webClientId ?? '');
  }, [googleIds]);

  const hasGoogleClient = clientId.length > 0;

  const googleConfig = useMemo(
    () =>
      ({
        clientId,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        useProxy: false,
      } as any as Partial<GoogleAuthRequestConfig>),
    [clientId, redirectUri]
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleConfig as any);

  useEffect(() => {
    if (response) {
      console.log('[Auth][Google] response', response);
    }
    const authenticate = async () => {
      if (response?.type === 'success') {
        try {
          setLoading(true);
          const idToken = (response.params as { id_token?: string } | undefined)?.id_token;
          if (!idToken) throw new Error('No se recibió ningún id_token de Google.');
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);

          const user = auth.currentUser;
          if (!user) {
            throw new Error('No se pudo obtener el usuario autenticado.');
          }

          const existingDoc = await getDoc(doc(db, 'users', user.uid));
          if (existingDoc.exists()) {
            await ensureUserProfile(user);
            router.replace('/(main)/home');
            return;
          }

          router.replace({
            pathname: '/personal-data',
            params: { mode: 'google' },
          });
        } catch (error: any) {
          Alert.alert('Google', error?.message ?? 'Error al iniciar sesión con Google.');
        } finally {
          setLoading(false);
        }
      } else if (response?.type === 'error') {
        Alert.alert('Google', response.error?.message ?? 'Error al iniciar sesión con Google.');
      }
    };

    authenticate();
  }, [response]);

  const handleGoogle = useCallback(async () => {
    if (!request || !hasGoogleClient) return;
    console.log('[Auth][Google] prompt', {
      hasRequest: !!request,
      requestUrl: request?.url,
      requestRedirect: request?.redirectUri,
      hasGoogleClient,
    });
    setLoading(true);
    try {
      await promptAsync({ useProxy: false } as any);
    } finally {
      setLoading(false);
    }
  }, [hasGoogleClient, promptAsync, request]);

  const handleEmailLogin = useCallback(async () => {
    if (!email || !password) {
      Alert.alert('Iniciar sesión', 'Ingresa correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await touchLastLogin(auth.currentUser);
      router.replace('/(main)/home');
    } catch (error: any) {
      Alert.alert('Iniciar sesión', error?.message ?? 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  const handleResetPassword = useCallback(async () => {
    if (!email) {
      Alert.alert('Recuperar contraseña', 'Ingresa tu correo para enviarte las instrucciones.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Recuperar contraseña', 'Te enviamos un correo para restablecer tu contraseña.');
    } catch (error: any) {
      Alert.alert('Recuperar contraseña', error?.message ?? 'No se pudo enviar el correo.');
    }
  }, [email]);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color={PRIMARY} name="arrow-back" size={24} />
          </Pressable>
          <Text style={styles.title}>Iniciar sesión</Text>
        </View>

        <Pressable
          disabled={!hasGoogleClient || !request || loading}
          onPress={handleGoogle}
          style={[styles.googleButton, loading && styles.disabledButton]}
        >
          <Image
            accessibilityIgnoresInvertColors
            source={require('../assets/images/google-logo.png')}
            style={styles.googleLogo}
          />
          <Text style={styles.googleLabel}>Continuar con Google</Text>
        </Pressable>

        <Text style={styles.dividerText}>O inicia sesión con correo electrónico</Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Correo electrónico"
          placeholderTextColor="#9B9B9B"
          style={styles.input}
          value={email}
        />
        <TextInput
          onChangeText={setPassword}
          placeholder="Contraseña"
          placeholderTextColor="#9B9B9B"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable onPress={handleEmailLogin} style={styles.primaryButton}>
          <Text style={styles.primaryLabel}>Iniciar sesión</Text>
        </Pressable>

        <Pressable onPress={handleResetPassword} style={styles.linkButton}>
          <Text style={styles.linkLabel}>Olvidé la contraseña</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: 999,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 28,
    color: PRIMARY,
    marginTop: 8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EFF1',
    paddingVertical: 14,
    borderRadius: 14,
  },
  disabledButton: {
    opacity: 0.7,
  },
  googleLogo: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  googleLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    color: '#1F2933',
  },
  dividerText: {
    textAlign: 'center',
    color: '#9B9B9B',
    marginVertical: 18,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E5E7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    color: '#1F2933',
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkLabel: {
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
