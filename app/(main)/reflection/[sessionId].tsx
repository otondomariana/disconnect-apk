import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

const PRIMARY = '#039EA2';

type Params = {
  sessionId?: string;
  challengeId?: string;
  title?: string;
  instructions?: string;
  origin?: string;
  originDate?: string;
};

export default function ReflectionScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const sessionId = useMemo(() => (typeof params.sessionId === 'string' ? params.sessionId : ''), [params.sessionId]);
  const challengeId = useMemo(
    () => (typeof params.challengeId === 'string' ? params.challengeId : undefined),
    [params.challengeId]
  );
  const challengeTitle = useMemo(
    () => (typeof params.title === 'string' ? params.title : 'Tu reflexión'),
    [params.title]
  );
  const challengeInstructions = useMemo(
    () => (typeof params.instructions === 'string' ? params.instructions : ''),
    [params.instructions]
  );
  const origin = typeof params.origin === 'string' ? params.origin : 'challenge';
  const originDate = typeof params.originDate === 'string' ? params.originDate : undefined;

  const [text, setText] = useState('');
  const [shareWithCommunity, setShareWithCommunity] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = Boolean(text.trim()) && Boolean(sessionId) && Boolean(user?.uid) && !saving;

  const handleToggleShare = (value: boolean) => {
    setShareWithCommunity(value);
    if (!value) {
      setAnonymous(false);
    }
  };

  const navigateAfterSave = () => {
    if (origin === 'logbook') {
      if (originDate) {
        router.replace({
          pathname: '/(main)/logbook/[date]',
          params: { date: originDate },
        } as never);
      } else {
        router.replace('/(main)/logbook');
      }
    } else {
      router.replace('/(main)/home');
    }
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Reflexión vacía', 'Escribe tu reflexión antes de guardarla.');
      return;
    }
    if (!sessionId) {
      Alert.alert('Error', 'No pudimos identificar esta sesión de desafío.');
      return;
    }
    if (!user?.uid) {
      Alert.alert('Error', 'Tu sesión expiró. Vuelve a iniciar sesión.');
      return;
    }
    setSaving(true);
    try {
      const timestamp = Timestamp.fromDate(new Date());
      await addDoc(collection(db, 'reflections'), {
        text: trimmed,
        userId: user.uid,
        sessionId,
        challengeId: challengeId ?? null,
        isPublic: shareWithCommunity,
        isAnonymous: shareWithCommunity ? anonymous : false,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      Alert.alert('¡Listo!', 'Tu reflexión se guardó correctamente.', [
        {
          text: 'Aceptar',
          onPress: navigateAfterSave,
        },
      ]);
    } catch (error) {
      console.error('[Reflection] No se pudo guardar la reflexión.', error);
      Alert.alert('Error', 'No pudimos guardar tu reflexión. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    if (origin === 'logbook' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/home');
    }
  };

  const disableAnonymousSwitch = !shareWithCommunity;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={22} color={PRIMARY} />
          <Text style={styles.backLabel}>Volver</Text>
        </Pressable>

        <Text style={styles.title}>{challengeTitle}</Text>
        {Boolean(challengeInstructions) && (
          <Text style={styles.subtitle}>{challengeInstructions}</Text>
        )}

        <View style={styles.inputWrapper}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Escribe tu reflexión..."
            style={styles.textInput}
            textAlignVertical="top"
            maxLength={2000}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchTextWrapper}>
            <Text style={styles.switchTitle}>Compartir con la comunidad</Text>
            <Text style={styles.switchSubtitle}>
              Otros usuarios podrán leer tu reflexión.
            </Text>
          </View>
          <Switch
            value={shareWithCommunity}
            onValueChange={handleToggleShare}
            trackColor={{ false: '#D1D5DB', true: '#7FD5D7' }}
            thumbColor={shareWithCommunity ? PRIMARY : '#F4F4F5'}
          />
        </View>

        <View style={[styles.switchRow, !shareWithCommunity && styles.switchRowDisabled]}>
          <View style={styles.switchTextWrapper}>
            <Text style={styles.switchTitle}>Publicar como anónima</Text>
            <Text style={styles.switchSubtitle}>
              Si compartes, puedes ocultar tu nombre para mantener tu privacidad.
            </Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            disabled={disableAnonymousSwitch}
            trackColor={{ false: '#D1D5DB', true: '#7FD5D7' }}
            thumbColor={!disableAnonymousSwitch && anonymous ? PRIMARY : '#F4F4F5'}
          />
        </View>

        <Pressable
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
          onPress={canSubmit ? handleSave : undefined}
          accessibilityState={{ disabled: !canSubmit }}
        >
          <Text style={styles.primaryLabel}>
            {saving ? 'Guardando reflexión...' : 'Guardar reflexión'}
          </Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={handleGoBack}>
          <Text style={styles.linkLabel}>
            {origin === 'logbook' ? 'Volver a Bitácora' : 'Volver al Inicio'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  content: {
    paddingBottom: 48,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backLabel: {
    marginLeft: 4,
    color: PRIMARY,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#039EA2',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
    textAlign: 'center',
    marginBottom: 16,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#039EA2',
    borderRadius: 18,
    padding: 12,
    minHeight: 200,
    marginBottom: 24,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 16,
  },
  switchRowDisabled: {
    opacity: 0.5,
  },
  switchTextWrapper: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#1F2933',
  },
  switchSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#6E6E6E',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkLabel: {
    color: PRIMARY,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
  },
});





