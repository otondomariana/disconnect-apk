import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useCallback, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '@/lib/firebase';

const PRIMARY = '#039EA2';

export default function RecoverPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    const handleResetPassword = useCallback(async () => {
        if (!email) {
            Alert.alert('Recuperar contraseña', 'Ingresa tu correo electrónico para enviarte las instrucciones.');
            return;
        }

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim());
            Alert.alert(
                'Correo enviado',
                'Te enviamos un correo con un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada o carpeta de spam.',
                [
                    { text: 'OK', onPress: () => router.back() }
                ]
            );
        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'No se pudo enviar el correo de recuperación.');
        } finally {
            setLoading(false);
        }
    }, [email]);

    return (
        <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#282828" />
                </Pressable>
                <Text style={styles.headerTitle}>Recuperar contraseña</Text>
                <View style={styles.headerRight} />
            </View>

            <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <Text style={styles.description}>
                        Ingresa la dirección de correo electrónico asociada a tu cuenta y te enviaremos un enlace para que puedas crear una nueva contraseña.
                    </Text>

                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        onChangeText={setEmail}
                        placeholder="Correo electrónico"
                        placeholderTextColor="#9B9B9B"
                        style={styles.input}
                        value={email}
                        editable={!loading}
                    />

                    <Pressable
                        onPress={handleResetPassword}
                        style={[styles.primaryButton, loading && styles.disabledButton]}
                        disabled={loading}
                    >
                        <Text style={styles.primaryLabel}>
                            {loading ? 'Enviando...' : 'Enviar enlace'}
                        </Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F5F5',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#282828',
    },
    headerRight: {
        width: 40
    },
    container: {
        flexGrow: 1,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 32,
    },
    description: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 32,
        textAlign: 'center',
        lineHeight: 24,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E0E5E7',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 24,
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 15,
        color: '#1F2933',
    },
    primaryButton: {
        backgroundColor: PRIMARY,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    primaryLabel: {
        color: '#FFFFFF',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.7,
    },
});
