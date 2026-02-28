import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryKey, normalizeCategoryKey } from '@/constants/categories';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

const PRIMARY = '#039EA2';
const FEED_LIMIT = 8;
const CACHE_KEY = '@community_daily_feed_v2';
const CACHE_DATE_KEY = '@community_daily_date_v2';

type ReflectionCard = {
    id: string;
    text: string;
    challengeTitle: string;
    challengeId: string;
    challengeCategory?: CategoryKey;
    isAnonymous: boolean;
    authorName?: string; // displayName from users collection, only when isAnonymous=false
};

type ChallengeOption = {
    id: string;
    title: string;
    category?: CategoryKey;
};

export default function CommunityScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    const [reflections, setReflections] = useState<ReflectionCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Cargar el feed de reflexiones
    useEffect(() => {
        let cancelled = false;
        const loadFeed = async () => {
            setLoading(true);
            setError(null);
            try {
                const todayStr = new Date().toISOString().split('T')[0];

                // 1. Intentar cargar desde el caché local
                try {
                    const cachedDate = await AsyncStorage.getItem(CACHE_DATE_KEY);
                    if (cachedDate === todayStr) {
                        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
                        if (cachedData) {
                            const parsed = JSON.parse(cachedData) as ReflectionCard[];
                            if (parsed.length > 0) {
                                if (!cancelled) {
                                    setReflections(parsed);
                                    setLoading(false);
                                }
                                return;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Community] Error leyendo caché', e);
                }

                // 2. Si no hay caché de hoy, buscar en Firestore
                // Solicitamos un pool de reflexiones (ej. las 300 más recientes) para luego elegir 8 al azar
                const baseQuery = query(
                    collection(db, 'reflections'),
                    where('isPublic', '==', true),
                    where('active', '==', true),
                    orderBy('createdAt', 'desc'),
                    limit(300)
                );

                const snap = await getDocs(baseQuery);

                // Filtrar reflexiones válidas (que no sean del usuario actual y tengan texto)
                const validDocs = snap.docs.filter((docSnap) => {
                    const data = docSnap.data() as { text?: string; userId?: string };
                    if (data.userId && data.userId === user?.uid) return false;
                    const text = data.text?.toString().trim() ?? '';
                    if (!text) return false;
                    return true;
                });

                // Mezclar (Shuffle) y tomar hasta 8
                const shuffledDocs = validDocs.sort(() => 0.5 - Math.random());
                const pickedDocs = shuffledDocs.slice(0, FEED_LIMIT);

                const cards: ReflectionCard[] = [];
                const sessionCache = new Map<string, string>();
                const challengeCache = new Map<string, ChallengeOption>();
                const userCache = new Map<string, string | null>();

                for (const docSnap of pickedDocs) {
                    const data = docSnap.data() as {
                        text?: string;
                        userId?: string;
                        sessionId?: string;
                        isAnonymous?: boolean;
                    };

                    const text = data.text?.toString().trim() ?? '';
                    let challengeId = '';
                    let challengeTitle = 'Desafío';
                    let challengeCategory: CategoryKey | undefined;

                    // Resolver info del desafío
                    if (data.sessionId) {
                        if (!sessionCache.has(data.sessionId)) {
                            try {
                                const sSnap = await getDoc(doc(db, 'challengeSessions', data.sessionId));
                                sessionCache.set(data.sessionId, (sSnap.data() as any)?.challengeId ?? '');
                            } catch {
                                sessionCache.set(data.sessionId, '');
                            }
                        }
                        challengeId = sessionCache.get(data.sessionId) ?? '';

                        if (challengeId) {
                            if (!challengeCache.has(challengeId)) {
                                try {
                                    const cSnap = await getDoc(doc(db, 'challenges', challengeId));
                                    const cData = cSnap.data() as { title?: string; category?: string } | undefined;
                                    const cat = normalizeCategoryKey((cData?.category ?? '').toString());
                                    challengeCache.set(challengeId, {
                                        id: challengeId,
                                        title: cData?.title?.toString().trim() ?? 'Desafío',
                                        category: cat,
                                    });
                                } catch {
                                    challengeCache.set(challengeId, { id: challengeId, title: 'Desafío' });
                                }
                            }
                            const ch = challengeCache.get(challengeId)!;
                            challengeTitle = ch.title;
                            challengeCategory = ch.category;
                        }
                    }

                    // Resolver info del autor
                    const isAnonymous = data.isAnonymous !== false;
                    let authorName: string | undefined;

                    if (!isAnonymous && data.userId) {
                        if (!userCache.has(data.userId)) {
                            try {
                                const uSnap = await getDoc(doc(db, 'users', data.userId));
                                const displayName = (uSnap.data() as { displayName?: string } | undefined)?.displayName ?? null;
                                userCache.set(data.userId, displayName);
                            } catch {
                                userCache.set(data.userId, null);
                            }
                        }
                        authorName = userCache.get(data.userId) ?? undefined;
                    }

                    cards.push({
                        id: docSnap.id,
                        text,
                        challengeTitle,
                        challengeId,
                        challengeCategory,
                        isAnonymous,
                        authorName,
                    });
                }

                if (!cancelled) {
                    setReflections(cards);
                    // Guardar en caché para que el resto del día muestre las mismas 8
                    if (cards.length > 0) {
                        try {
                            await AsyncStorage.setItem(CACHE_DATE_KEY, todayStr);
                            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cards));
                        } catch (e) {
                            console.warn('[Community] Error guardando caché', e);
                        }
                    }
                }
            } catch (e) {
                console.error('[Community] Error cargando el feed.', e);
                if (!cancelled) setError('No pudimos cargar las reflexiones. Intenta nuevamente.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadFeed();
        return () => { cancelled = true; };
    }, [user?.uid]);

    const handleGoBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(main)/home');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="chevron-back" size={24} color="#282828" />
                </Pressable>
                <Text style={styles.headerTitle}>Comunidad</Text>
                <View style={styles.headerRight} />
            </View>


            {/* Feed */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={PRIMARY} size="large" />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Ionicons name="cloud-offline-outline" size={48} color="#C4C4C4" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : reflections.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="chatbubbles-outline" size={64} color="#C4C4C4" />
                    <Text style={styles.emptyTitle}>
                        Aún no hay reflexiones compartidas.
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        Completá un desafío y compartí tu reflexión.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={reflections}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.feedList}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="flag" size={16} color={PRIMARY} style={{ marginTop: 2 }} />
                                <Text style={styles.cardChallengeTitle}>
                                    {item.challengeTitle}
                                </Text>
                            </View>
                            <View style={styles.cardTextRow}>
                                <Ionicons name="chatbubbles-outline" size={16} color="#B0B0B0" style={{ marginTop: 4 }} />
                                <Text style={styles.cardText}>{item.text}</Text>
                            </View>
                            <View style={styles.cardFooter}>
                                <Ionicons name="person-outline" size={13} color="#B0B0B0" />
                                <Text style={styles.cardAnonymous}>
                                    {item.isAnonymous || !item.authorName ? 'Anónimo' : item.authorName}
                                </Text>
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Nota de privacidad */}
            {!loading && reflections.length > 0 && (
                <View style={styles.privacyNote}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#A0A0A0" />
                    <Text style={styles.privacyText}>
                        Las reflexiones dentro de Disconnect no permiten interacciones.
                    </Text>
                </View>
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
    headerRight: { width: 40 },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 8,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#6E6E6E',
    },

    // Feed
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 16,
    },
    errorText: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Medium',
        color: '#6E6E6E',
        textAlign: 'center',
    },
    emptyTitle: {
        fontSize: 17,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#282828',
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#6E6E6E',
        textAlign: 'center',
        lineHeight: 21,
    },
    feedList: {
        padding: 20,
        gap: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        gap: 12,
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 4,
    },
    cardChallengeTitle: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Bold',
        color: PRIMARY,
        lineHeight: 22,
    },
    cardTextRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    cardText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#1F2933',
        lineHeight: 24,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderTopWidth: 1,
        borderTopColor: '#F0F5F5',
        paddingTop: 10,
    },
    cardAnonymous: {
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#B0B0B0',
    },
    privacyNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F5F5',
        backgroundColor: '#FFFFFF',
    },
    privacyText: {
        flex: 1,
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#A0A0A0',
        lineHeight: 18,
    },
});
