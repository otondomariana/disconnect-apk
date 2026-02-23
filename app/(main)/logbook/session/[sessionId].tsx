import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatDateKey, formatLongDate, formatTime, fromFirestoreDate } from '@/lib/date';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

type SessionDetail = {
  id: string;
  challengeId: string;
  challengeTitle: string;
  challengeInstructions: string;
  durationMinutes: number;
  startedAt?: Date;
  finishedAt?: Date;
};

type ReflectionInfo = {
  id: string;
  text: string;
  isPublic: boolean;
  isAnonymous: boolean;
  active: boolean;
};

const PRIMARY = '#039EA2';

export default function LogbookSessionScreen() {
  const { sessionId, date } = useLocalSearchParams<{ sessionId?: string; date?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [reflection, setReflection] = useState<ReflectionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId || !user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const sessionSnap = await getDoc(doc(db, 'challengeSessions', sessionId));
      if (!sessionSnap.exists()) {
        setError('No encontramos información de este desafío.');
        return;
      }
      const data = sessionSnap.data() as {
        challengeId?: string;
        startedAt?: unknown;
        finishedAt?: unknown;
        completed?: boolean;
        userId?: string;
      };
      if (data.userId && data.userId !== user.uid) {
        setError('No puedes ver esta sesión.');
        return;
      }
      if (!data.challengeId) {
        setError('Este desafío no tiene información asociada.');
        return;
      }
      const challengeSnap = await getDoc(doc(db, 'challenges', data.challengeId));
      const challenge = challengeSnap.data() as { title?: string; instructions?: string; durationMinutes?: number };

      const sessionDetail: SessionDetail = {
        id: sessionSnap.id,
        challengeId: data.challengeId,
        challengeTitle: challenge?.title?.toString() ?? 'Desafío',
        challengeInstructions: challenge?.instructions?.toString() ?? '',
        durationMinutes: Number(challenge?.durationMinutes) || 0,
        startedAt: fromFirestoreDate(data.startedAt),
        finishedAt: fromFirestoreDate(data.finishedAt),
      };

      let reflectionInfo: ReflectionInfo | null = null;
      const reflectionSnap = await getDocs(
        query(collection(db, 'reflections'), where('sessionId', '==', sessionSnap.id), limit(1))
      );
      reflectionSnap.forEach((docSnap) => {
        const reflectionData = docSnap.data() as {
          text?: string;
          isPublic?: boolean;
          isAnonymous?: boolean;
          active?: boolean;
          userId?: string;
        };
        if (reflectionData.userId && reflectionData.userId !== user.uid) {
          return;
        }
        reflectionInfo = {
          id: docSnap.id,
          text: reflectionData.text?.toString() ?? '',
          isPublic: Boolean(reflectionData.isPublic),
          isAnonymous: Boolean(reflectionData.isAnonymous),
          active: reflectionData.active !== false,
        };
      });

      setSession(sessionDetail);
      setReflection(reflectionInfo);
    } catch (err) {
      console.error('[LogbookSession] Error al cargar la sesión.', err);
      setError('No pudimos cargar los detalles. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.uid]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession])
  );

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/logbook');
    }
  };

  const handleWriteReflection = () => {
    if (!session) return;
    const returnDate =
      typeof date === 'string'
        ? date
        : session.finishedAt
          ? formatDateKey(session.finishedAt)
          : undefined;
    router.push({
      pathname: '/(main)/reflection/[sessionId]',
      params: {
        sessionId: session.id,
        challengeId: session.challengeId,
        title: session.challengeTitle,
        instructions: session.challengeInstructions,
        origin: 'logbook',
        originDate: returnDate,
      },
    } as never);
  };

  const handleViewReflection = () => {
    if (!reflection) return;
    router.push({
      pathname: '/(main)/logbook/reflection/[reflectionId]',
      params: { reflectionId: reflection.id },
    } as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={24} color="#282828" />
          </Pressable>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.fullCenter}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={24} color="#282828" />
          </Pressable>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.fullCenter}>
          <Text style={styles.errorText}>{error ?? 'No encontramos este desafío.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={24} color="#282828" />
        </Pressable>
        <Text style={styles.headerTitle}>{session.challengeTitle}</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <Text style={styles.instructions}>{session.challengeInstructions}</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Duración</Text>
          <Text style={styles.infoValue}>{session.durationMinutes} minutos</Text>
          <Text style={styles.infoLabel}>Comenzó</Text>
          <Text style={styles.infoValue}>
            {formatLongDate(session.startedAt) || 'Sin registro'}
            {session.startedAt ? ` - ${formatTime(session.startedAt)}` : ''}
          </Text>
          <Text style={styles.infoLabel}>Finalizó</Text>
          <Text style={styles.infoValue}>
            {formatLongDate(session.finishedAt) || 'Sin registro'}
            {session.finishedAt ? ` - ${formatTime(session.finishedAt)}` : ''}
          </Text>
        </View>

        <View style={styles.reflectionCard}>
          <Text style={styles.reflectionTitle}>Reflexión</Text>
          {reflection ? (
            <>
              <Text style={styles.reflectionStatus}>
                {reflection.isPublic
                  ? reflection.isAnonymous
                    ? 'Publicada como anónima'
                    : 'Publicada'
                  : 'Guardada en privado'}
              </Text>
              <Pressable style={styles.primaryButton} onPress={handleViewReflection}>
                <Text style={styles.primaryLabel}>Ver reflexión</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.reflectionStatus}>
                Aún no escribiste una reflexión sobre este desafío.
              </Text>
              <Pressable style={styles.secondaryButton} onPress={handleWriteReflection}>
                <Text style={styles.secondaryLabel}>Escribir reflexión</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
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
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    width: 40,
  },
  fullCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#F5FAFA',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    gap: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
    marginBottom: 8,
  },
  reflectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E5E7',
    padding: 16,
    gap: 12,
  },
  reflectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
  },
  reflectionStatus: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#4B5A66',
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: PRIMARY,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
  },
});



