import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatLongDate } from '@/lib/date';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

const PRIMARY = '#039EA2';

export default function AchievementsScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const [achievements, setAchievements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const loadAchievements = async () => {
            if (!user?.uid) {
                if (active) setLoading(false);
                return;
            }
            try {
                const achievementsSnap = await getDocs(
                    query(collection(db, 'userAchievements'), where('userId', '==', user.uid))
                );

                const typesSnap = await getDocs(collection(db, 'achievementTypes'));
                const typesRecord: Record<string, any> = {};
                typesSnap.forEach(docSnap => {
                    typesRecord[docSnap.id] = docSnap.data();
                });

                const achievementsData: any[] = [];
                achievementsSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    // Fix: Corregido a achievementTypeId en lugar de achievementId
                    const typeId = data.achievementTypeId;
                    const typeInfo = typeId ? typesRecord[typeId] : null;

                    if (typeInfo || data.name) {
                        achievementsData.push({
                            id: docSnap.id,
                            name: typeInfo?.name || data.name || (typeId === 'first_challenge_completed' ? 'Primer Desafío' : 'Logro obtenido'),
                            description: typeInfo?.description || data.description || (typeId === 'first_challenge_completed' ? 'Completaste tu primer desafío.' : ''),
                            obtainedAt: data.obtainedAt,
                        });
                    }
                });

                achievementsData.sort((a, b) => {
                    const timeA = a.obtainedAt?.seconds || 0;
                    const timeB = b.obtainedAt?.seconds || 0;
                    return timeB - timeA; // Descendente por fecha
                });

                if (active) setAchievements(achievementsData);
            } catch (e) {
                console.error('[Achievements] Error loading user achievements', e);
            } finally {
                if (active) setLoading(false);
            }
        };

        loadAchievements();
        return () => {
            active = false;
        };
    }, [user?.uid]);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(main)/profile');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="chevron-back" size={24} color="#282828" />
                </Pressable>
                <Text style={styles.headerTitle}>Tus Logros</Text>
                <View style={styles.headerRight} />
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator color={PRIMARY} size="large" />
                </View>
            ) : achievements.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="trophy-outline" size={64} color="#C4C4C4" />
                    <Text style={styles.emptyText}>Aún no tienes logros. ¡Sigue completando desafíos!</Text>
                </View>
            ) : (
                <FlatList
                    data={achievements}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                        let dateString = 'Fecha desconocida';
                        if (item.obtainedAt?.seconds) {
                            const d = new Date(item.obtainedAt.seconds * 1000);
                            dateString = formatLongDate(d);
                        }

                        return (
                            <View style={styles.achievementItem}>
                                <View style={styles.achievementIconContainer}>
                                    <Ionicons name="trophy" size={28} color="#FBC02D" />
                                </View>
                                <View style={styles.achievementInfo}>
                                    <Text style={styles.achievementName}>{item.name}</Text>
                                    {!!item.description && <Text style={styles.achievementDesc}>{item.description}</Text>}
                                    <Text style={styles.achievementDate}>Obtenido el {dateString}</Text>
                                </View>
                            </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
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
    headerRight: {
        width: 40,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 24,
        fontSize: 18,
        fontFamily: 'PlusJakartaSans-Medium',
        color: '#6E6E6E',
        textAlign: 'center',
        lineHeight: 28,
    },
    listContainer: {
        padding: 24,
    },
    achievementItem: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    achievementIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF8E1',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 20,
    },
    achievementInfo: {
        flex: 1,
    },
    achievementName: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#282828',
        marginBottom: 6,
    },
    achievementDesc: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#6E6E6E',
        marginBottom: 10,
        lineHeight: 22,
    },
    achievementDate: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Medium',
        color: '#A0A0A0',
    },
});
