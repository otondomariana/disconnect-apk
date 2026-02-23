// app/privacy-security.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteAccountAndData } from '@/lib/delete-account';

export default function PrivacySecurityScreen() {
    const router = useRouter();
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const handleDeletePress = () => {
        Alert.alert(
            'Eliminar cuenta y datos',
            'Esta acción es permanente e irreversible. Se eliminarán tu cuenta, desafíos, logros y reflexiones.\n\n¿Deseas continuar?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sí, continuar',
                    style: 'destructive',
                    onPress: () => {
                        setPassword('');
                        setPasswordError('');
                        setShowPasswordModal(true);
                    },
                },
            ]
        );
    };

    const handleConfirmDelete = async () => {
        if (!password.trim()) {
            setPasswordError('Ingresa tu contraseña para continuar.');
            return;
        }

        setPasswordError('');
        setDeleting(true);
        try {
            await deleteAccountAndData(password);
            // El listener onAuthStateChanged en _layout.tsx detectará
            // que el usuario ya no existe y redirigirá a /welcome automáticamente.
            setShowPasswordModal(false);
        } catch (error: any) {
            setDeleting(false);
            const code: string = error?.code ?? '';
            if (
                code === 'auth/wrong-password' ||
                code === 'auth/invalid-credential' ||
                code === 'auth/invalid-login-credentials'
            ) {
                setPasswordError('Contraseña incorrecta. Intentá de nuevo.');
            } else if (code === 'auth/too-many-requests') {
                setPasswordError('Demasiados intentos. Esperá unos minutos.');
            } else {
                Alert.alert('Error', 'No pudimos eliminar tu cuenta. Intenta nuevamente más tarde.');
                setShowPasswordModal(false);
            }
        }
    };

    const handleCloseModal = () => {
        if (deleting) return;
        setShowPasswordModal(false);
        setPassword('');
        setPasswordError('');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#282828" />
                </Pressable>
                <Text style={styles.headerTitle}>Privacidad y Seguridad</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Sección: Tus datos */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tus datos</Text>
                    <View style={styles.infoCard}>
                        <InfoRow
                            icon="person-outline"
                            title="Perfil"
                            description="Nombre, correo y fecha de nacimiento."
                        />
                        <View style={styles.divider} />
                        <InfoRow
                            icon="flag-outline"
                            title="Desafíos"
                            description="Historial de sesiones de desafíos completados."
                        />
                        <View style={styles.divider} />
                        <InfoRow
                            icon="trophy-outline"
                            title="Logros"
                            description="Insignias y logros desbloqueados."
                        />
                        <View style={styles.divider} />
                        <InfoRow
                            icon="document-text-outline"
                            title="Reflexiones"
                            description="Textos escritos al finalizar un desafío."
                        />
                    </View>
                </View>

                {/* Sección: Cuenta */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cuenta</Text>
                    <View style={styles.dangerCard}>
                        <Pressable
                            style={({ pressed }) => [styles.dangerItem, pressed && { opacity: 0.7 }]}
                            onPress={handleDeletePress}
                        >
                            <View style={styles.dangerIconContainer}>
                                <Ionicons name="trash-outline" size={20} color="#D64545" />
                            </View>
                            <View style={styles.dangerTextContainer}>
                                <Text style={styles.dangerItemTitle}>Eliminar cuenta y datos</Text>
                                <Text style={styles.dangerItemSubtitle}>
                                    Elimina permanentemente tu cuenta y todos tus datos.
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#D64545" />
                        </Pressable>
                    </View>
                </View>

            </ScrollView>

            {/* Modal de confirmación con contraseña */}
            <Modal
                visible={showPasswordModal}
                transparent
                animationType="fade"
                onRequestClose={handleCloseModal}
            >
                <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
                    <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalIconContainer}>
                            <Ionicons name="warning-outline" size={32} color="#D64545" />
                        </View>

                        <Text style={styles.modalTitle}>Confirmar eliminación</Text>
                        <Text style={styles.modalSubtitle}>
                            Ingresa tu contraseña para confirmar. Esta acción no se puede deshacer.
                        </Text>

                        <TextInput
                            style={[styles.passwordInput, passwordError ? styles.passwordInputError : null]}
                            placeholder="Contraseña actual"
                            placeholderTextColor="#B0B0B0"
                            secureTextEntry
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                if (passwordError) setPasswordError('');
                            }}
                            editable={!deleting}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        {passwordError ? (
                            <Text style={styles.errorText}>{passwordError}</Text>
                        ) : null}

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }, deleting && { opacity: 0.5 }]}
                                onPress={handleCloseModal}
                                disabled={deleting}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [styles.modalDeleteBtn, pressed && { opacity: 0.8 }, deleting && { opacity: 0.7 }]}
                                onPress={handleConfirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={styles.modalDeleteText}>Eliminar</Text>
                                )}
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// Componente auxiliar para filas informativas
function InfoRow({
    icon,
    title,
    description,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
}) {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
                <Ionicons name={icon} size={18} color="#039EA2" />
            </View>
            <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>{title}</Text>
                <Text style={styles.infoDescription}>{description}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7FAFA',
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
    headerRight: { width: 40 },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#282828',
        marginBottom: 12,
        marginLeft: 4,
    },
    // Info card
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 16,
        shadowColor: '#000000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
    },
    infoIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoTitle: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#282828',
        marginBottom: 2,
    },
    infoDescription: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#6E6E6E',
        lineHeight: 18,
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F5F5',
        marginLeft: 50,
    },
    // Danger card
    dangerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#FCE8E8',
        shadowColor: '#D64545',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    dangerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
    },
    dangerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FCE8E8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    dangerTextContainer: {
        flex: 1,
    },
    dangerItemTitle: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#D64545',
        marginBottom: 2,
    },
    dangerItemSubtitle: {
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#E07070',
        lineHeight: 17,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 28,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FCE8E8',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#282828',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#6E6E6E',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    passwordInput: {
        width: '100%',
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#282828',
        backgroundColor: '#F7FAFA',
        marginBottom: 8,
    },
    passwordInputError: {
        borderColor: '#D64545',
    },
    errorText: {
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#D64545',
        alignSelf: 'flex-start',
        marginBottom: 16,
        marginLeft: 4,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#F0F5F5',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#6E6E6E',
    },
    modalDeleteBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#D64545',
        alignItems: 'center',
    },
    modalDeleteText: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#FFFFFF',
    },
});
