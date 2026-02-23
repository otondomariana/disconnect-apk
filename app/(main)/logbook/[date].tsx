import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatDateKey, formatLongDate, fromFirestoreDate, parseDateKey } from '@/lib/date';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

type SessionItem = {
  id: string;
  challengeId: string;
  challengeTitle: string;
  challengeInstructions: string;
  finishedAt?: Date;
};

const PRIMARY = '#039EA2';

export default function LogbookDayScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const displayDate = useMemo(() => parseDateKey(typeof date === 'string' ? date : undefined), [date]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!date || !user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(db, 'challengeSessions'), where('userId', '==', user.uid)));
      const filtered: SessionItem[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data() as {
          challengeId?: string;
          finishedAt?: unknown;
          completed?: boolean;
        };
        if (data.completed === false) return;
        const finished = fromFirestoreDate(data.finishedAt);
        if (!finished) return;
        if (formatDateKey(finished) !== date) return;
        if (!data.challengeId) return;
        filtered.push({
          id: docSnap.id,
          challengeId: data.challengeId,
          challengeTitle: '',
          challengeInstructions: '',
          finishedAt: finished,
        });
      });

      filtered.sort((a, b) => {
        const timeA = a.finishedAt?.getTime() ?? 0;
        const timeB = b.finishedAt?.getTime() ?? 0;
        return timeB - timeA;
      });

      const challengeCache = new Map<string, { title: string; instructions: string }>();

      const withDetails: SessionItem[] = [];
      for (const item of filtered) {
        if (!challengeCache.has(item.challengeId)) {
          const challengeSnap = await getDoc(doc(db, 'challenges', item.challengeId));
          const challengeData = challengeSnap.data() as { title?: string; instructions?: string };
          challengeCache.set(item.challengeId, {
            title: challengeData?.title?.toString() ?? 'Desafío',
            instructions: challengeData?.instructions?.toString() ?? '',
          });
        }
        const challenge = challengeCache.get(item.challengeId)!;
        withDetails.push({
          ...item,
          challengeTitle: challenge.title,
          challengeInstructions: challenge.instructions,
        });
      }

      setSessions(withDetails);
      if (!withDetails.length) {
        setError('No registramos desafíos completados en esa fecha.');
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('[LogbookDay] No pudimos cargar desafíos por fecha.', err);
      setError('No pudimos cargar los desafíos. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [date, user?.uid]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const handleSelectSession = (sessionId: string) => {
    if (!date) return;
    router.push({
      pathname: '/(main)/logbook/session/[sessionId]',
      params: { sessionId, date },
    } as never);
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={24} color="#282828" />
        </Pressable>
        <Text style={styles.headerTitle}>{formatLongDate(displayDate)}</Text>
        <View style={styles.headerRight} />
      </View>

      <Text style={styles.subtitle}>Desafíos completados este día</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sessions.map((session) => (
            <Pressable
              key={session.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => handleSelectSession(session.id)}
            >
              <Text style={styles.cardTitle}>{session.challengeTitle}</Text>
              <Text style={styles.cardDescription} numberOfLines={3}>
                {session.challengeInstructions}
              </Text>
              <Text style={styles.cardLink}>Ver detalles</Text>
            </Pressable>
          ))}
        </ScrollView>
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
  subtitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#4B5A66',
    marginBottom: 16,
    marginTop: 12,
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#4B5A66',
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
  },
  cardLink: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: PRIMARY,
  },
});



