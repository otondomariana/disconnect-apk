import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
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

import { getChallengeIllustration } from '@/constants/challenge-illustrations';
import { normalizeCategoryKey, type CategoryKey } from '@/constants/categories';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

const PRIMARY = '#039EA2';

type ChallengeDetail = {
  id: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  category?: CategoryKey;
};

type ChallengeStatus = 'idle' | 'running' | 'completed';

const formatTimer = (value: number) => {
  const safeValue = Math.max(0, value);
  const hours = Math.floor(safeValue / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safeValue % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(safeValue % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export default function ChallengeDetailScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState<boolean>(true);
  const [status, setStatus] = useState<ChallengeStatus>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadChallenge = async () => {
      setChallengeError(null);
      if (!challengeId) {
        setChallenge(null);
        setChallengeError('No encontramos la información del desafío.');
        setLoadingChallenge(false);
        return;
      }

      setLoadingChallenge(true);
      try {
        const snap = await getDoc(doc(db, 'challenges', challengeId));
        if (!snap.exists()) {
          if (!cancelled) {
            setChallenge(null);
            setChallengeError('No encontramos la información del desafío.');
          }
          return;
        }
        const data = snap.data() as {
          title?: string;
          instructions?: string;
          durationMinutes?: number;
          category?: string;
        };
        const duration = Number(data.durationMinutes) || 0;
        const rawCategory = (data.category ?? '').toString();
        const normalizedCategory = normalizeCategoryKey(rawCategory);
        if (!cancelled) {
          setChallenge({
            id: snap.id,
            title: data.title?.toString().trim() || 'Desafío',
            instructions: data.instructions?.toString().trim() || '',
            durationMinutes: duration > 0 ? duration : 1,
            category: normalizedCategory,
          });
        }
      } catch (error) {
        console.error('[ChallengeDetail] No fue posible cargar el desafío.', error);
        if (!cancelled) setChallengeError('No pudimos cargar el desafío.');
      } finally {
        if (!cancelled) setLoadingChallenge(false);
      }
    };

    loadChallenge();
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  useEffect(() => {
    setStatus('idle');
    setRemainingSeconds(0);
    setStartedAt(null);
    setSessionSaved(false);
    setSessionError(null);
    setSessionId(null);
  }, [challenge?.id]);

  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === 'running' && remainingSeconds === 0) {
      setStatus('completed');
    }
  }, [status, remainingSeconds]);

  const persistSession = useCallback(async () => {
    if (!challenge || !user?.uid || !startedAt || sessionSaved || savingSession) return;
    setSavingSession(true);
    setSessionError(null);
    try {
      const docRef = await addDoc(collection(db, 'challengeSessions'), {
        challengeId: challenge.id,
        userId: user.uid,
        startedAt: Timestamp.fromDate(startedAt),
        finishedAt: Timestamp.fromDate(new Date()),
        completed: true,
      });
      setSessionSaved(true);
      setSessionId(docRef.id);
    } catch (error) {
      console.error('[ChallengeDetail] No se pudo guardar la sesión.', error);
      setSessionError('No pudimos guardar tu desafío. Intenta nuevamente.');
    } finally {
      setSavingSession(false);
    }
  }, [challenge, savingSession, sessionSaved, startedAt, user?.uid]);

  useEffect(() => {
    if (status === 'completed') {
      persistSession();
    }
  }, [status, persistSession]);

  const handleStart = () => {
    if (!challenge) return;
    setRemainingSeconds(Math.max(1, challenge.durationMinutes) * 60);
    setStartedAt(new Date());
    setStatus('running');
    setSessionSaved(false);
    setSessionError(null);
    setSessionId(null);
  };

  const handleCancel = () => {
    setStatus('idle');
    setRemainingSeconds(0);
    setStartedAt(null);
    setSessionError(null);
    setSessionId(null);
  };

  const handleGoBack = () => {
    router.replace('/(main)/home');
  };

  const handleWriteReflection = () => {
    if (!challenge || !sessionId) {
      setSessionError('Aún estamos guardando tu desafío. Intenta nuevamente en unos segundos.');
      return;
    }
    router.push({
      pathname: '/(main)/reflection/[sessionId]',
      params: {
        sessionId,
        challengeId: challenge.id,
        title: challenge.title,
        instructions: challenge.instructions,
      },
    } as never);
  };

  const showRetry = status === 'completed' && !sessionSaved && Boolean(sessionError);

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.backButton} onPress={handleGoBack}>
        <Ionicons name="chevron-back" size={22} color={PRIMARY} />
        <Text style={styles.backLabel}>Volver</Text>
      </Pressable>
      {loadingChallenge ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : !challenge ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{challengeError ?? 'No pudimos cargar este desafío.'}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{challenge.title}</Text>
          <Text style={styles.instructions}>{challenge.instructions}</Text>
          <Image source={getChallengeIllustration(challenge.category)} style={styles.heroImage} />

          {status === 'running' ? (
            <>
              <Text style={styles.timerText}>{formatTimer(remainingSeconds)}</Text>
              <Pressable style={styles.linkButton} onPress={handleCancel}>
                <Text style={styles.linkLabel}>Cancelar</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.durationLabel}>
              Duración: {challenge.durationMinutes} minutos
            </Text>
          )}

          {status === 'idle' && (
            <Pressable style={styles.primaryButton} onPress={handleStart}>
              <Text style={styles.primaryLabel}>Comenzar</Text>
            </Pressable>
          )}

          {status === 'completed' && (
            <>
              <Text style={styles.completedTitle}>¡Buen trabajo!</Text>
              <Text style={styles.completedSubtitle}>
                Cuando estés listo, escribe una reflexión sobre tu experiencia.
              </Text>
              <Pressable
                style={[
                  styles.primaryButton,
                  (!sessionSaved || savingSession) && styles.primaryButtonDisabled,
                ]}
                onPress={sessionSaved ? handleWriteReflection : undefined}
                accessibilityState={{ disabled: !sessionSaved || savingSession }}
              >
                <Text style={styles.primaryLabel}>Escribir reflexión</Text>
              </Pressable>
              {savingSession && <Text style={styles.helperText}>Guardando tu desafío...</Text>}
            </>
          )}

          {sessionError && (
            <View style={styles.feedbackWrapper}>
              <Text style={styles.errorText}>{sessionError}</Text>
              {showRetry && (
                <Pressable style={styles.retryButton} onPress={persistSession}>
                  <Text style={styles.retryLabel}>Intentar nuevamente</Text>
                </Pressable>
              )}
            </View>
          )}

          {status !== 'running' && (
            <Pressable style={styles.linkButton} onPress={handleGoBack}>
              <Text style={styles.linkLabel}>Volver</Text>
            </Pressable>
          )}
        </ScrollView>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backLabel: {
    marginLeft: 4,
    color: PRIMARY,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
    marginBottom: 8,
  },
  instructions: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
    marginBottom: 18,
  },
  heroImage: {
    width: '100%',
    height: 230,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  durationLabel: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#1F2933',
    textAlign: 'center',
    marginBottom: 20,
  },
  timerText: {
    fontSize: 50,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2933',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkLabel: {
    color: PRIMARY,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  completedTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
    textAlign: 'center',
    marginTop: 12,
  },
  completedSubtitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  helperText: {
    textAlign: 'center',
    color: '#6E6E6E',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    marginTop: 4,
  },
  feedbackWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: '#D64545',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Medium',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  retryLabel: {
    color: PRIMARY,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 15,
  },
});
