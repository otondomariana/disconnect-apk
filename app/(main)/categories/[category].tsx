import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CATEGORY_CONFIG,
  CategoryConfig,
  CategoryKey,
  normalizeCategoryKey,
} from '@/constants/categories';
import { getChallengeIllustration } from '@/constants/challenge-illustrations';
import { db } from '@/lib/firebase';
import { useChallengeStore } from '@/stores/challenge';

type ChallengeItem = {
  id: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  category?: CategoryKey;
};

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const router = useRouter();
  const activeChallengeId = useChallengeStore((s) => s.activeChallengeId);

  const normalizedCategory = useMemo(
    () => (category ? normalizeCategoryKey(category.toString()) : undefined),
    [category]
  );

  const categoryData: CategoryConfig | undefined = useMemo(
    () => (normalizedCategory ? CATEGORY_CONFIG[normalizedCategory] : undefined),
    [normalizedCategory]
  );

  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(0);

  const durations = useMemo(() => {
    const seen = new Set<number>();
    challenges.forEach((c) => seen.add(c.durationMinutes));
    return Array.from(seen).sort((a, b) => a - b);
  }, [challenges]);

  const filtered = useMemo(() => {
    if (selectedDuration === 0) return challenges;
    return challenges.filter((c) => c.durationMinutes === selectedDuration);
  }, [challenges, selectedDuration]);

  useEffect(() => {
    let cancelled = false;

    const fetchChallenges = async () => {
      if (!normalizedCategory) {
        setError('Categoría no encontrada.');
        setChallenges([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'challenges'), where('category', '==', normalizedCategory));
        const snap = await getDocs(q);

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
            category: normalizeCategoryKey(data.category ?? normalizedCategory),
          });
        });

        if (!cancelled) {
          setChallenges(items);
          if (!items.length) {
            setError('No hay desafíos activos para esta categoría por ahora.');
          }
        }
      } catch (err) {
        console.error('[CategoryScreen] Error al cargar desafíos', err);
        if (!cancelled) {
          setError('No pudimos cargar los desafíos. Intenta nuevamente.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchChallenges();
    return () => {
      cancelled = true;
    };
  }, [normalizedCategory]);

  const handleOpenChallenge = (challenge: ChallengeItem) => {
    // Siempre navega al detalle del desafío seleccionado
    // (el detalle mismo bloquea "Comenzar" si hay otro en curso)
    router.push({
      pathname: '/(main)/challenge/[challengeId]',
      params: { challengeId: challenge.id },
    } as never);
  };

  const handleGoBack = () => {
    router.replace('/(main)/home');
  };

  if (!categoryData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={24} color="#282828" />
          </Pressable>
          <Text style={styles.headerTitle}>Categoría</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorTitle}>Categoría no encontrada</Text>
          <Text style={styles.errorSubtitle}>Regresa al Inicio y prueba con otra categoría.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={24} color="#282828" />
        </Pressable>
        <Text style={styles.headerTitle}>{categoryData.label}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.container}>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#039EA2" />
          </View>
        ) : error ? (
          <View style={styles.centeredContainer}>
            <Text style={styles.errorTitle}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.filtersBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersContent}
              >
                <Pressable
                  style={[styles.chip, selectedDuration === 0 && styles.chipActive]}
                  onPress={() => setSelectedDuration(0)}
                >
                  <Text style={[styles.chipText, selectedDuration === 0 && styles.chipTextActive]}>
                    Todos
                  </Text>
                </Pressable>

                {durations.map((dur) => (
                  <Pressable
                    key={dur}
                    style={[styles.chip, selectedDuration === dur && styles.chipActive]}
                    onPress={() => setSelectedDuration(selectedDuration === dur ? 0 : dur)}
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

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {filtered.length === 0 ? (
                <View style={styles.centeredContainer}>
                  <Text style={styles.errorTitle}>
                    No hay desafíos de {selectedDuration} minutos.
                  </Text>
                </View>
              ) : (
                filtered.map((challengeItem) => {
                  const isActive = activeChallengeId === challengeItem.id;
                  const isBlocked = activeChallengeId !== null && !isActive;
                  return (
                    <Pressable
                      key={challengeItem.id}
                      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                      onPress={() => handleOpenChallenge(challengeItem)}
                    >
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>{challengeItem.title}</Text>
                        <Text style={styles.cardDescription} numberOfLines={3}>
                          {challengeItem.instructions}
                        </Text>
                        <Text style={styles.cardDuration}>
                          Duración: {challengeItem.durationMinutes} minutos
                        </Text>
                        <View style={[
                          styles.cardButton,
                          isBlocked && styles.cardButtonDisabled,
                        ]}>
                          <Text style={styles.cardButtonLabel}>
                            {isActive ? 'En curso' : isBlocked ? 'Otro desafío en curso' : 'Comenzar'}
                          </Text>
                        </View>
                      </View>
                      <Image
                        source={getChallengeIllustration(challengeItem.category ?? normalizedCategory)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    width: 40
  },
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#4B5A66',
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
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
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
  },
  cardDuration: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#1F2933',
  },
  cardButton: {
    marginTop: 12,
    backgroundColor: '#039EA2',
    paddingVertical: 10,
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
    fontSize: 15,
  },
  cardImage: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    opacity: 0.6,
  },
  cardImageDimmed: {
    opacity: 0.25,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#9AA5B1',
    textAlign: 'center',
    marginTop: 6,
  },
  filtersBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F5',
    height: 56,
    justifyContent: 'center',
  },
  filtersContent: {
    gap: 8,
    paddingHorizontal: 24,
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
    backgroundColor: '#039EA2',
    borderColor: '#039EA2',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#4B5A66',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
