import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAchievementModalStore } from '@/stores/achievementModal';

export function AchievementModal() {
    const { isVisible, title, description, hideAchievement } = useAchievementModalStore();

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={hideAchievement}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="trophy" size={48} color="#FBC02D" />
                    </View>
                    <Text style={styles.title}>¡Nuevo Logro Obtenido!</Text>
                    <Text style={styles.achievementTitle}>{title}</Text>
                    <Text style={styles.description}>{description}</Text>

                    <Pressable style={styles.button} onPress={hideAchievement}>
                        <Text style={styles.buttonText}>¡Genial!</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFF8E1', // Light yellow background matching trophy
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 16,
        color: '#039EA2',
        marginBottom: 8,
        textAlign: 'center',
    },
    achievementTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 22,
        color: '#282828',
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#6E6E6E',
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#039EA2',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
    },
    buttonText: {
        color: '#FFFFFF',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 16,
        textAlign: 'center',
    },
});
