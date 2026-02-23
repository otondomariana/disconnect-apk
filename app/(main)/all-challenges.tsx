import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryKey, normalizeCategoryKey } from '@/constants/categories';
import { getChallengeIllustration } from '@/constants/challenge-illustrations';
import { db } from '@/lib/firebase';
import { useChallengeStore } from '@/stores/challenge';

const PRIMARY = '#039EA2';

type ChallengeItem = {
    id: string;
    title: string;
    instructions: string;
    durationMinutes: number;
    category?: CategoryKey;
};

const ALL_FILTER = 0;

export default function AllChallengesScreen() {
    const router = useRouter();
    const activeChallengeId = useChallengeStore((s) => s.activeChallengeId);

    const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<number>(ALL_FILTER);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        let cancelled = false;

        const fetchChallenges = async () => {
            setLoading(true);
            setError(null);
            try {
                const snap = await getDocs(collection(db, 'challenges'));
                const items: ChallengeItem[] = [];

                snap.forEach((docSnap) => {
                    const data = docSnap.data() as {
                        title?: string;
                        instructions?: string;
                        durationMinutes?: number;
                        active?: boolean;
                        category?: string;
                    };
                    const title = data.title?.toString().trim();
                    const instructions = data.instructions?.toString().trim();
                    const duration = Number(data.durationMinutes) || 0;
                    if (!title || !instructions || duration <= 0) return;
                    if (data.active === false) return;
                    items.push({
                        id: docSnap.id,
                        title,
                        instructions,
                        durationMinutes: duration,
                        category: normalizeCategoryKey(data.category ?? ''),
                    });
                });

                // Ordenar: por duración asc, luego por título
                items.sort((a, b) =>
                    a.durationMinutes !== b.durationMinutes
                        ? a.durationMinutes - b.durationMinutes
                        : a.title.localeCompare(b.title)
                );

                if (!cancelled) {
                    setChallenges(items);
                    if (!items.length) setError('No hay desafíos activos por ahora.');
                }
            } catch (err) {
                console.error('[AllChallenges] Error al cargar desafíos', err);
                if (!cancelled) setError('No pudimos cargar los desafíos. Intenta nuevamente.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchChallenges();
        return () => { cancelled = true; };
    }, []);

    // Duraciones únicas disponibles
    const durations = useMemo(() => {
        const seen = new Set<number>();
        challenges.forEach((c) => seen.add(c.durationMinutes));
        return Array.from(seen).sort((a, b) => a - b);
    }, [challenges]);

    const filtered = useMemo(() => {
        if (selectedDuration === ALL_FILTER) return challenges;
        return challenges.filter((c) => c.durationMinutes === selectedDuration);
    }, [challenges, selectedDuration]);

    const handleOpenChallenge = (challenge: ChallengeItem) => {
        const isBlocked = activeChallengeId !== null && activeChallengeId !== challenge.id;
        if (isBlocked) return;
        router.push({
            pathname: '/(main)/challenge/[challengeId]',
            params: { challengeId: challenge.id },
        } as never);
    };

    const handleGoBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(main)/home');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="chevron-back" size={24} color="#282828" />
                </Pressable>
                <Text style={styles.headerTitle}>Todos los desafíos</Text>
                <View style={styles.headerRight} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={PRIMARY} size="large" />
                </View>
            ) : error && !challenges.length ? (
                <View style={styles.centered}>
                    <Ionicons name="flash-outline" size={48} color="#C4C4C4" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <>
                    {/* Filtros por duración */}
                    <View style={styles.filtersBar}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filtersContent}
                        >
                            {/* Chip "Todos" */}
                            <Pressable
                                style={[styles.chip, selectedDuration === ALL_FILTER && styles.chipActive]}
                                onPress={() => setSelectedDuration(ALL_FILTER)}
                            >
                                <Text style={[styles.chipText, selectedDuration === ALL_FILTER && styles.chipTextActive]}>
                                    Todos
                                </Text>
                            </Pressable>

                            {durations.map((dur) => (
                                <Pressable
                                    key={dur}
                                    style={[styles.chip, selectedDuration === dur && styles.chipActive]}
                                    onPress={() => setSelectedDuration(selectedDuration === dur ? ALL_FILTER : dur)}
                                >
                                    <Ionicons
                                        name="time-outline"
                                        size={13}
                                        color={selectedDuration === dur ? '#FFFFFF' : '#4B5A66'}
                                    />
                                    <Text style={[styles.chipText, selectedDuration === dur && styles.chipTextActive]}>
                                        {dur} min
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Lista */}
                    <ScrollView
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                    >
                        {filtered.length === 0 ? (
                            <View style={styles.centered}>
                                <Text style={styles.errorText}>
                                    No hay desafíos de {selectedDuration} minutos.
                                </Text>
                            </View>
                        ) : (
                            filtered.map((item) => {
                                const isBlocked = activeChallengeId !== null && activeChallengeId !== item.id;
                                return (
                                    <Pressable
                                        key={item.id}
                                        style={({ pressed }) => [styles.card, pressed && !isBlocked && styles.cardPressed]}
                                        onPress={() => handleOpenChallenge(item)}
                                    >
                                        <View style={styles.cardInfo}>
                                            <Text style={styles.cardTitle}>{item.title}</Text>
                                            <Text style={styles.cardDescription} numberOfLines={3}>
                                                {item.instructions}
                                            </Text>
                                            <Text style={styles.cardDuration}>
                                                Duración: {item.durationMinutes} minutos
                                            </Text>
                                            <View style={[styles.cardButton, isBlocked && styles.cardButtonDisabled]}>
                                                <Text style={styles.cardButtonLabel}>
                                                    {isBlocked ? 'Otro desafío en curso' : 'Comenzar'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Image
                                            source={getChallengeIllustration(item.category)}
                                            style={[styles.cardImage, isBlocked && styles.cardImageDimmed]}
                                        />
                                    </Pressable>
                                );
                            })
                        )}
                    </ScrollView>
                </>
            )}
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
    // Filtros
    filtersBar: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F5F5',
        height: 56,
        justifyContent: 'center',
    },
    filtersContent: {
        gap: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        height: 56,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F5FAFA',
        borderWidth: 1,
        borderColor: '#E0E5E7',
    },
    chipActive: {
        backgroundColor: PRIMARY,
        borderColor: PRIMARY,
    },
    chipText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Medium',
        color: '#4B5A66',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    // Lista
    list: {
        padding: 20,
        gap: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#E0EAEB',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center',
    },
    cardPressed: {
        opacity: 0.92,
    },
    cardInfo: {
        flex: 1,
        gap: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#0F4D4F',
    },
    cardDescription: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#1F2933',
        lineHeight: 20,
    },
    cardDuration: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Medium',
        color: '#1F2933',
    },
    cardButton: {
        marginTop: 8,
        backgroundColor: PRIMARY,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 14,
        alignSelf: 'flex-start',
    },
    cardButtonDisabled: {
        backgroundColor: '#A8B8C0',
    },
    cardButtonLabel: {
        color: '#FFFFFF',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
    cardImage: {
        width: 100,
        height: 100,
        resizeMode: 'contain',
        opacity: 0.6,
    },
    cardImageDimmed: {
        opacity: 0.3,
    },
});
