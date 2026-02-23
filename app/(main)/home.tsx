import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CATEGORY_CONFIG,
  CategoryConfig,
  CategoryKey,
  DEFAULT_CATEGORY_KEYS,
  normalizeCategoryKey,
} from '@/constants/categories';
import { getChallengeIllustration } from '@/constants/challenge-illustrations';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';
import { useChallengeStore } from '@/stores/challenge';

type ChallengeSummary = {
  id: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  active?: boolean;
  category?: CategoryKey;
};

const getDaySeed = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor((now.getTime() - startOfYear.getTime()) / oneDay);
};

const pickChallengeForToday = (candidates: ChallengeSummary[]) => {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  const seed = getDaySeed();
  const index = seed % sorted.length;
  return sorted[index];
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const activeChallengeId = useChallengeStore((s) => s.activeChallengeId);
  const activeChallengeTitle = useChallengeStore((s) => s.activeChallengeTitle);
  const [displayName, setDisplayName] = useState<string>('');
  const [categories, setCategories] = useState<CategoryConfig[]>(
    DEFAULT_CATEGORY_KEYS.map((key) => CATEGORY_CONFIG[key])
  );
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [dailyChallenge, setDailyChallenge] = useState<ChallengeSummary | null>(null);
  const [loadingDailyChallenge, setLoadingDailyChallenge] = useState<boolean>(false);
  const [dailyChallengeCompleted, setDailyChallengeCompleted] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const checkCompletion = async () => {
        if (!dailyChallenge || !user?.uid) {
          if (!cancelled) setDailyChallengeCompleted(false);
          return;
        }
        try {
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          const sessionsQuery = query(
            collection(db, 'challengeSessions'),
            where('userId', '==', user.uid),
            where('challengeId', '==', dailyChallenge.id),
            where('completed', '==', true)
          );

          const sessionsSnap = await getDocs(sessionsQuery);

          let hasCompletedToday = false;
          sessionsSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.finishedAt && data.finishedAt.toDate() >= startOfDay) {
              hasCompletedToday = true;
            }
          });

          if (!cancelled) {
            setDailyChallengeCompleted(hasCompletedToday);
          }
        } catch (err) {
          console.warn('[Home] Error checking daily challenge completion', err);
        }
      };

      checkCompletion();

      return () => {
        cancelled = true;
      };
    }, [dailyChallenge, user?.uid])
  );

  useEffect(() => {
    let active = true;

    const loadName = async () => {
      const fallback = user?.displayName ?? '';
      try {
        if (!user) {
          if (active) setDisplayName(fallback);
          return;
        }

        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? (snap.data() as { displayName?: string; name?: string }) : undefined;
        const storedName = data?.displayName ?? data?.name;
        if (active) {
          setDisplayName(storedName?.trim() || fallback);
        }
      } catch {
        if (active) setDisplayName(fallback);
      }
    };

    loadName();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const snap = await getDocs(collection(db, 'challenges'));
        const found = new Set<CategoryConfig['key']>();

        snap.forEach((docSnap) => {
          const data = docSnap.data() as { category?: string; categoría?: string };
          const raw = (data.category ?? data.categoría ?? '').toString();
          const normalized = normalizeCategoryKey(raw);
          if (normalized) found.add(normalized);
        });

        if (!cancelled && found.size > 0) {
          setCategories(Array.from(found).map((key) => CATEGORY_CONFIG[key]));
        }
      } catch (error) {
        console.warn('[Home] No fue posible cargar categorías desde Firestore.', error);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDailyChallenge = async () => {
      setLoadingDailyChallenge(true);
      try {
        const snap = await getDocs(collection(db, 'challenges'));
        const candidates: ChallengeSummary[] = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() as {
            title?: string;
            instructions?: string;
            durationMinutes?: number;
            category?: string;
            active?: boolean;
          };
          const title = data.title?.toString().trim() ?? '';
          const instructions = data.instructions?.toString().trim() ?? '';
          const duration = Number(data.durationMinutes) || 0;

          if (!title || !instructions || duration <= 0) return;
          if (data.active === false) return;
          const rawCategory = (data.category ?? '').toString();
          const normalizedCategory = normalizeCategoryKey(rawCategory);

          candidates.push({
            id: docSnap.id,
            title,
            instructions,
            durationMinutes: duration,
            active: data.active,
            category: normalizedCategory,
          });
        });

        if (!cancelled) {
          setDailyChallenge(pickChallengeForToday(candidates));
        }
      } catch (error) {
        console.warn('[Home] No fue posible cargar el desafA-o del dA-a.', error);
        if (!cancelled) setDailyChallenge(null);
      } finally {
        if (!cancelled) setLoadingDailyChallenge(false);
      }
    };

    loadDailyChallenge();
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = useMemo(() => {
    if (!displayName) return 'Hola!';
    return `Hola, ${displayName}!`;
  }, [displayName]);

  const handleCategoryPress = (category: CategoryConfig) => {
    router.push({
      pathname: '/(main)/categories/[category]',
      params: { category: category.key },
    } as never);
  };

  const handleAllChallengesPress = () => {
    router.push('/(main)/all-challenges' as never);
  };

  const handleActiveChallengePress = () => {
    if (!activeChallengeId) return;
    router.push({
      pathname: '/(main)/challenge/[challengeId]',
      params: { challengeId: activeChallengeId },
    } as never);
  };

  const handleDailyChallengePress = () => {
    if (!dailyChallenge) return;
    const isDailyBlocked = activeChallengeId !== null && activeChallengeId !== dailyChallenge.id;
    if (isDailyBlocked) return;
    router.push({
      pathname: '/(main)/challenge/[challengeId]',
      params: { challengeId: dailyChallenge.id },
    } as never);
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>¿Qué quieres hacer hoy?</Text>

        {/* ── Banner desafío en curso ── */}
        {activeChallengeId && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver al desafío en curso"
            style={({ pressed }) => [styles.activeCard, pressed && styles.activeCardPressed]}
            onPress={handleActiveChallengePress}
          >
            <View style={styles.activePulse} />
            <View style={styles.activeCardInfo}>
              <Text style={styles.activeCardEyebrow}>DESAFÍO EN CURSO</Text>
              <Text style={styles.activeCardTitle} numberOfLines={1}>
                {activeChallengeTitle ?? 'Desafío'}
              </Text>
              <Text style={styles.activeCardCta}>Toca para volver al temporizador</Text>
            </View>
            <Ionicons name="timer-outline" size={32} color="#039EA2" />
          </Pressable>
        )}

        <View style={styles.categoriesWrapper}>
          {loadingCategories ? (
            <ActivityIndicator color="#039EA2" />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {categories.map((category) => (
                <Pressable
                  key={category.key}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    pressed && styles.categoryCardPressed,
                  ]}
                  onPress={() => handleCategoryPress(category)}
                >
                  <View style={styles.categoryImageWrapper}>
                    <Ionicons name={category.iconName} size={36} color="#FFFFFF" />
                  </View>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Todos los desafíos ── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todos los desafíos"
          style={({ pressed }) => [styles.allCard, pressed && styles.allCardPressed]}
          onPress={handleAllChallengesPress}
        >
          <Ionicons name="apps-outline" size={32} color="#0F4D4F" />
          <View style={styles.allCardInfo}>
            <Text style={styles.allCardTitle}>Ver todos los desafíos</Text>
            <Text style={styles.allCardDescription}>Explorá todos los desafíos disponibles</Text>
          </View>
          <Ionicons name="chevron-forward" size={28} color="#0F4D4F" />
        </Pressable>

        <View style={styles.challengeSection}>
          <Text style={styles.sectionHeading}>Tu desafío del día</Text>
          {loadingDailyChallenge ? (
            <View style={[styles.challengeCard, styles.challengeCardLoading]}>
              <ActivityIndicator color="#039EA2" />
            </View>
          ) : dailyChallenge ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir desafío ${dailyChallenge.title}`}
              style={({ pressed }) => [styles.challengeCard, pressed && styles.challengeCardPressed]}
              onPress={handleDailyChallengePress}
            >
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>{dailyChallenge.title}</Text>
                {dailyChallengeCompleted && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                    <Text style={styles.completedBadgeText}>COMPLETADO</Text>
                  </View>
                )}
                <Text style={styles.challengeDescription} numberOfLines={3}>
                  {dailyChallenge.instructions}
                </Text>
                <Text style={styles.challengeDuration}>
                  Duración: {dailyChallenge.durationMinutes} minutos
                </Text>
                {(() => {
                  const isDailyBlocked = activeChallengeId !== null && activeChallengeId !== dailyChallenge.id;
                  return (
                    <View style={[styles.challengeButton, isDailyBlocked && styles.challengeButtonDisabled]}>
                      {!isDailyBlocked && (
                        <Ionicons name={dailyChallengeCompleted ? 'reload' : 'play'} size={18} color="#FFFFFF" />
                      )}
                      <Text style={styles.challengeButtonLabel}>
                        {isDailyBlocked ? 'Otro desafío en curso' : dailyChallengeCompleted ? 'Realizar de nuevo' : 'Comenzar'}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Image source={getChallengeIllustration(dailyChallenge.category)} style={styles.challengeImage} />
            </Pressable>
          ) : (
            <View style={[styles.challengeCard, styles.challengeCardEmpty]}>
              <Text style={styles.challengeEmptyTitle}>No encontramos desafíos activos.</Text>
              <Text style={styles.challengeEmptySubtitle}>Intenta nuevamente más tarde.</Text>
            </View>
          )}
        </View>

        {/* ── Sección Comunidad ── */}
        <View style={styles.communitySection}>
          <Text style={styles.sectionHeading}>Comunidad</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a Comunidad"
            style={({ pressed }) => [styles.communityCard, pressed && styles.communityCardPressed]}
            onPress={() => router.push('/community' as never)}
          >
            <View style={styles.communityInfo}>
              <Text style={styles.communityTitle}>Accede a la comunidad</Text>
              <Text style={styles.communityDescription}>
                Lee las reflexiones de los demás usuarios
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={28} color="#0F4D4F" />
          </Pressable>
        </View>
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
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  greeting: {
    flex: 1,
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#282828',
    marginBottom: 20,
  },
  categoriesWrapper: {
    height: 150,
    marginBottom: 16,
  },
  categoriesRow: {
    gap: 16,
  },
  categoryCard: {
    width: 110,
    height: 110,
    backgroundColor: '#039EA2',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  categoryCardPressed: {
    opacity: 0.85,
  },
  categoryImageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  categoryImage: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
  },
  categoryLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-Medium',
    textAlign: 'center',
  },
  challengeSection: {
    marginBottom: 32,
  },
  communitySection: {
    marginBottom: 16,
  },
  communityCard: {
    borderRadius: 24,
    backgroundColor: '#E0EAEB',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  communityCardPressed: {
    opacity: 0.92,
  },
  communityInfo: {
    flex: 1,
    gap: 8,
  },
  communityTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
  },
  communityDescription: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
  },
  sectionHeading: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
    marginBottom: 12,
  },
  challengeCard: {
    minHeight: 160,
    borderRadius: 24,
    backgroundColor: '#E0EAEB',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  challengeCardPressed: {
    opacity: 0.92,
  },
  challengeCardLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeInfo: {
    flex: 1,
    gap: 8,
  },
  challengeTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  completedBadgeText: {
    color: '#2E7D32',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  challengeDescription: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
  },
  challengeDuration: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#1F2933',
  },
  challengeButton: {
    marginTop: 12,
    backgroundColor: '#039EA2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  challengeButtonDisabled: {
    backgroundColor: '#A8B8C0',
  },
  challengeButtonLabel: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
  },
  challengeImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    opacity: 0.6,
  },
  challengeCardEmpty: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
  },
  challengeEmptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2933',
    marginBottom: 4,
  },
  challengeEmptySubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#4B5A66',
  },
  allCard: {
    borderRadius: 24,
    backgroundColor: '#E0EAEB',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  allCardPressed: {
    opacity: 0.92,
  },
  allCardInfo: {
    flex: 1,
    gap: 4,
  },
  allCardTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
  },
  allCardDescription: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
  },
  // Active challenge banner
  activeCard: {
    borderRadius: 20,
    backgroundColor: '#EAF7F7',
    borderWidth: 1.5,
    borderColor: '#039EA2',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  activeCardPressed: {
    opacity: 0.88,
  },
  activePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#039EA2',
  },
  activeCardInfo: {
    flex: 1,
    gap: 2,
  },
  activeCardEyebrow: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#039EA2',
    letterSpacing: 0.8,
  },
  activeCardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
  },
  activeCardCta: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#4B5A66',
  },

});
