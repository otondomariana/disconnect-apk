import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

import {
  CATEGORY_CONFIG,
  CategoryConfig,
  CategoryKey,
  DEFAULT_CATEGORY_KEYS,
  normalizeCategoryKey,
} from '@/constants/categories';
import { getChallengeIllustration } from '@/constants/challenge-illustrations';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

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
  const [displayName, setDisplayName] = useState<string>('');
  const [categories, setCategories] = useState<CategoryConfig[]>(
    DEFAULT_CATEGORY_KEYS.map((key) => CATEGORY_CONFIG[key])
  );
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [dailyChallenge, setDailyChallenge] = useState<ChallengeSummary | null>(null);
  const [loadingDailyChallenge, setLoadingDailyChallenge] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const loadName = async () => {
      const fallback = auth.currentUser?.displayName ?? '';
      try {
        if (!user) {
          if (active) setDisplayName(fallback);
          return;
        }

        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? (snap.data() as { displayName?: string; name?: string }) : undefined;
        const storedName = data?.displayName ?? data?.name;
        if (active) {
          setDisplayName(storedName?.trim() || fallback || user.email || '');
        }
      } catch {
        if (active) setDisplayName(fallback || user?.email || '');
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

  const handleDailyChallengePress = () => {
    if (!dailyChallenge) return;
    router.push({
      pathname: '/(main)/challenge/[challengeId]',
      params: { challengeId: dailyChallenge.id },
    } as never);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await auth.signOut();
    } catch (error) {
      Alert.alert('Error', 'No pudimos cerrar sesión. Intenta nuevamente.');
      console.error('[Home] signOut error', error);
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir menú"
          style={styles.menuButton}
          onPress={() => setMenuOpen((prev) => !prev)}
        >
          <Ionicons name="menu" size={28} color="#282828" />
        </Pressable>
        <Text style={styles.greeting}>{greeting}</Text>
      </View>

      <Text style={styles.subtitle}>¿Qué quieres hacer hoy?</Text>

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
                  <Image source={category.image} style={styles.categoryImage} />
                </View>
                <Text style={styles.categoryLabel}>{category.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

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
              <Text style={styles.challengeDescription} numberOfLines={3}>
                {dailyChallenge.instructions}
              </Text>
              <Text style={styles.challengeDuration}>
                Duración: {dailyChallenge.durationMinutes} minutos
              </Text>
              <View style={styles.challengeButton}>
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={styles.challengeButtonLabel}>Comenzar</Text>
              </View>
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

      {menuOpen && (
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuPanel}>
            <Text style={styles.menuTitle}>Menú</Text>
            <View style={styles.menuItemRow}>
              <Text style={styles.menuItemLabel}>Comunidad</Text>
            </View>
            <View style={styles.menuItemRow}>
              <Text style={styles.menuItemLabel}>Configuración</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.menuItemRow, pressed && styles.menuItemPressed]}
              onPress={handleSignOut}
            >
              <Text style={[styles.menuItemLabel, styles.menuItemLogout]}>
                {signingOut ? 'Cerrando...' : 'Cerrar sesión'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
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
    marginBottom: 32,
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
  menuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  menuPanel: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  menuTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
  },
  menuItemRow: {
    paddingVertical: 8,
  },
  menuItemLabel: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#282828',
  },
  menuItemPressed: {
    opacity: 0.75,
  },
  menuItemLogout: {
    color: '#D64545',
  },
});
