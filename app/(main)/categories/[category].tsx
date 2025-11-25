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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';

import {
  CATEGORY_CONFIG,
  CategoryConfig,
  CategoryKey,
  normalizeCategoryKey,
} from '@/constants/categories';
import { getChallengeIllustration } from '@/constants/challenge-illustrations';
import { db } from '@/lib/firebase';

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
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Categoría no encontrada</Text>
        <Text style={styles.errorSubtitle}>Regresa al Inicio y prueba con otra categoría.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={handleGoBack}>
        <Ionicons name="chevron-back" size={22} color="#039EA2" />
        <Text style={styles.backLabel}>Volver</Text>
      </Pressable>
      <Text style={styles.title}>{categoryData.label}</Text>
      <Text style={styles.subtitle}>Elige el desafío que quieras hacer hoy.</Text>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#039EA2" />
        </View>
      ) : error ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.errorTitle}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {challenges.map((challengeItem) => (
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
                <View style={styles.cardButton}>
                  <Text style={styles.cardButtonLabel}>Comenzar</Text>
                </View>
              </View>
              <Image
                source={getChallengeIllustration(challengeItem.category ?? normalizedCategory)}
                style={styles.cardImage}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backLabel: {
    color: '#039EA2',
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#039EA2',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#4B5A66',
    marginBottom: 16,
  },
  list: {
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
});
