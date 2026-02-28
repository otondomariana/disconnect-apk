import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatLongDate, formatTime } from '@/lib/date';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

const PRIMARY = '#039EA2';

type ReflectionItem = {
    id: string;
    text: string;
    createdAt: Date;
    sessionId: string;
    challengeTitle: string;
};

export default function MyReflectionsScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    const [reflections, setReflections] = useState<ReflectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!user?.uid) {
                if (active) setLoading(false);
                return;
            }
            try {
                // 1. Fetch user's reflections
                const snap = await getDocs(
                    query(collection(db, 'reflections'), where('userId', '==', user.uid))
                );

                const raw: { id: string; text: string; createdAt: Date; sessionId: string; challengeId: string | null }[] = [];
                snap.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (!data.active) return;

                    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

                    raw.push({
                        id: docSnap.id,
                        text: data.text || '',
                        createdAt,
                        sessionId: data.sessionId || '',
                        challengeId: data.challengeId || null,
                    });
                });

                // Sort by newest first
                raw.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

                // 2. Resolve challenge titles
                const cache = new Map<string, string>();
                const withTitles: ReflectionItem[] = [];

                for (const item of raw) {
                    if (!active) break;
                    let title = 'Desafío Completo';

                    if (item.challengeId) {
                        if (!cache.has(item.challengeId)) {
                            const cSnap = await getDoc(doc(db, 'challenges', item.challengeId));
                            const cData = cSnap.data();
                            cache.set(item.challengeId, cData?.title?.toString() || 'Desafío Completo');
                        }
                        title = cache.get(item.challengeId)!;
                    }

                    withTitles.push({
                        id: item.id,
                        text: item.text,
                        createdAt: item.createdAt,
                        sessionId: item.sessionId,
                        challengeTitle: title,
                    });
                }

                if (active) {
                    setReflections(withTitles);
                    setError(withTitles.length === 0 ? 'Aún no has escrito ninguna reflexión.' : null);
                }
            } catch (err) {
                console.error('[MyReflections]', err);
                if (active) setError('No pudimos cargar tus reflexiones. Intenta nuevamente.');
            } finally {
                if (active) setLoading(false);
            }
        };

        load();
        return () => { active = false; };
    }, [user?.uid]);

    const handleGoBack = () => router.canGoBack() ? router.back() : router.replace('/(main)/profile');

    const handleSelectReflection = (id: string) => {
        router.push({
            pathname: '/(main)/logbook/reflection/[reflectionId]',
            params: { reflectionId: id, origin: 'my-reflections' }
        } as never);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="chevron-back" size={24} color="#282828" />
                </Pressable>
                <Text style={styles.headerTitle}>Mis Reflexiones</Text>
                <View style={styles.headerRight} />
            </View>

            {loading ? (
                <View style={styles.centerContent}><ActivityIndicator color={PRIMARY} size="large" /></View>
            ) : error && reflections.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="document-text-outline" size={64} color="#C4C4C4" />
                    <Text style={styles.emptyText}>{error}</Text>
                </View>
            ) : (
                <FlatList
                    data={reflections}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                            onPress={() => handleSelectReflection(item.id)}
                        >
                            <Text style={styles.cardTitle}>{item.challengeTitle}</Text>
                            <Text style={styles.cardTime}>
                                {formatLongDate(item.createdAt)} - {formatTime(item.createdAt)}
                            </Text>
                            <Text style={styles.cardDescription} numberOfLines={3}>{item.text}</Text>
                            <Text style={styles.cardLink}>Ver reflexión</Text>
                        </Pressable>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F5F5'
    },
    backButton: { padding: 8, marginLeft: -8 },
    headerTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans-Bold', color: '#282828' },
    headerRight: { width: 40 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { padding: 20, paddingBottom: 40, gap: 16 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
    emptyText: { fontSize: 17, fontFamily: 'PlusJakartaSans-Medium', color: '#6E6E6E', textAlign: 'center', lineHeight: 26 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        gap: 8,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2
    },
    cardPressed: { opacity: 0.7 },
    cardTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans-Bold', color: '#0F4D4F' },
    cardTime: { fontSize: 14, fontFamily: 'PlusJakartaSans-Medium', color: '#4B5A66' },
    cardDescription: { fontSize: 15, fontFamily: 'PlusJakartaSans-Regular', color: '#1F2933', lineHeight: 22 },
    cardLink: { fontSize: 15, fontFamily: 'PlusJakartaSans-Bold', color: PRIMARY, marginTop: 4 },
});
