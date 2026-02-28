import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeCategoryKey, type CategoryKey } from '@/constants/categories';
import { getChallengeIllustration } from '@/constants/challenge-illustrations';
import { buildDateKeyFromParts, calculateStreak, fromFirestoreDate, getLogicalDateParts } from '@/lib/date';
import { db } from '@/lib/firebase';
import {
  cancelChallengeTimerNotification,
  requestNotificationPermissions,
  setupNotificationChannel,
  showChallengeEndTimeNotification,
  showChallengeTimerNotification,
} from '@/lib/notifications';
import { useAchievementModalStore } from '@/stores/achievementModal';
import { useAuthStore } from '@/stores/auth';
import { useChallengeStore } from '@/stores/challenge';

const PRIMARY = '#039EA2';

type ChallengeDetail = {
  id: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  category?: CategoryKey;
};

type ChallengeStatus = 'idle' | 'running' | 'paused' | 'completed';

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
  const setActiveChallenge = useChallengeStore((s) => s.setActiveChallenge);
  const activeChallengeId = useChallengeStore((s) => s.activeChallengeId);
  const setTimerRunning = useChallengeStore((s) => s.setTimerRunning);
  const setTimerPaused = useChallengeStore((s) => s.setTimerPaused);
  const setTimerResumed = useChallengeStore((s) => s.setTimerResumed);
  const storeStatus = useChallengeStore((s) => s.activeChallengeStatus);
  const storeEndAtMs = useChallengeStore((s) => s.activeEndAtMs);
  const storeStartedAtMs = useChallengeStore((s) => s.activeStartedAtMs);
  const storePausedRemaining = useChallengeStore((s) => s.activePausedRemaining);
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

  // Ref para rastrear si los permisos de notificación ya fueron solicitados
  const notifPermGranted = useRef(false);
  // Timestamp (ms) en que el timer debe terminar — para recalcular tras background
  const endAtRef = useRef<number | null>(null);
  // Ref sincronizada con `status` para leerla desde callbacks sin closure stale
  const statusRef = useRef<ChallengeStatus>('idle');

  // Ref sincronizada con `challenge` para leerla desde callbacks sin closure stale
  const challengeRef = useRef<ChallengeDetail | null>(null);

  // Mantener statusRef y challengeRef sincronizados
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    challengeRef.current = challenge;
  }, [challenge]);

  // Configurar canal Android + cleanup al desmontar
  useEffect(() => {
    setupNotificationChannel();
    return () => {
      cancelChallengeTimerNotification();
    };
  }, []);

  // Detectar foreground/background para cambiar el tipo de notificación y verificar engaños de reloj
  useEffect(() => {
    let backgroundWallClock: number | null = null;
    let backgroundUptime: number | null = null;
    let expectedRemainingAtBg: number | null = null;

    const sub = AppState.addEventListener('change', async (nextState) => {
      const isRunning = statusRef.current === 'running';
      const title = challengeRef.current?.title;

      if ((nextState === 'background' || nextState === 'inactive') && isRunning && endAtRef.current && title) {
        // App va a background
        backgroundWallClock = Date.now();
        backgroundUptime = await Device.getUptimeAsync();
        expectedRemainingAtBg = Math.max(0, Math.round((endAtRef.current - backgroundWallClock) / 1000));

        showChallengeEndTimeNotification(title, endAtRef.current);
      } else if (nextState === 'active' && isRunning && endAtRef.current) {
        // App vuelve al foreground: recalcular.
        const nowWallClock = Date.now();
        const nowUptime = await Device.getUptimeAsync();

        let remaining = Math.max(0, Math.round((endAtRef.current - nowWallClock) / 1000));

        if (backgroundWallClock && expectedRemainingAtBg !== null && backgroundUptime !== null) {
          const deltaWallClock = nowWallClock - backgroundWallClock;
          const deltaUptime = nowUptime - backgroundUptime;

          // Uptime in Android stops in deep sleep, so deltaUptime <= deltaWallClock generally.
          // Fraud detection: If wall clock jumped FORWARD massively more than Uptime (e.g. user changed time).
          // We allow some flexibility for device drift, but if it's over 1 minute off, it's highly suspect.
          // Fraud detection 2: If wall clock jumped BACKWARD significantly (negative deltaWallClock).
          const isForwardFraud = deltaWallClock > deltaUptime + 60000;
          const isBackwardFraud = deltaWallClock < 0;

          if (isBackwardFraud || isForwardFraud) {
            console.warn(`[ChallengeDetail] Clock anomaly detected. Wall: ${deltaWallClock}ms, Uptime: ${deltaUptime}ms, Reverting to safe monotonic progression.`);
            // Nullify the fraudulent wall clock shift, trust the uptime delta as the true elapsed time 
            // (or if deep sleep happened, it just pauses the timer safely offline)
            const safeElapsedMs = Math.max(0, deltaUptime);
            const safeElapsedSecs = Math.round(safeElapsedMs / 1000);

            remaining = Math.max(0, expectedRemainingAtBg - safeElapsedSecs);
            // Fix the actual internal wall clock target for intervals until next bg
            endAtRef.current = nowWallClock + (remaining * 1000);
          }
        }

        setRemainingSeconds(remaining);
        if (remaining === 0) {
          setStatus('completed');
        }
      }
    });
    return () => sub.remove();
  }, []);

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

  // Al cargar un desafío: restaurar estado del store si es el activo, o resetear
  useEffect(() => {
    if (!challenge) return;

    if (challenge.id === activeChallengeId && storeStatus) {
      if (storeStatus === 'running' && storeEndAtMs !== null) {
        const remaining = Math.max(0, Math.round((storeEndAtMs - Date.now()) / 1000));
        endAtRef.current = storeEndAtMs;
        setRemainingSeconds(remaining);
        setStartedAt(storeStartedAtMs ? new Date(storeStartedAtMs) : new Date());
        setStatus(remaining > 0 ? 'running' : 'completed');
      } else if (storeStatus === 'paused' && storePausedRemaining !== null) {
        endAtRef.current = null;
        setRemainingSeconds(storePausedRemaining);
        setStartedAt(storeStartedAtMs ? new Date(storeStartedAtMs) : new Date());
        setStatus('paused');
      }
      return;
    }

    setStatus('idle');
    setRemainingSeconds(0);
    setStartedAt(null);
    setSessionSaved(false);
    setSessionError(null);
    setSessionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Actualizar la notificación cada vez que cambia el tiempo restante (mientras corre)
  useEffect(() => {
    if (status === 'running' && remainingSeconds > 0 && challenge?.title && notifPermGranted.current) {
      showChallengeTimerNotification(challenge.title, remainingSeconds);
    }
  }, [remainingSeconds, status, challenge?.title]);

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

      // Evaluar si es el primer desafío y otorgar el logro
      try {
        const achievementsSnap = await getDocs(
          query(
            collection(db, 'userAchievements'),
            where('userId', '==', user.uid)
          )
        );

        const hasFirstChallenge = achievementsSnap.docs.some((d) => d.data().achievementTypeId === 'first_challenge_completed');
        const has7DayStreak = achievementsSnap.docs.some((d) => d.data().achievementTypeId === 'streak_7_days');

        if (!hasFirstChallenge || !has7DayStreak) {
          const sessionsSnap = await getDocs(
            query(collection(db, 'challengeSessions'), where('userId', '==', user.uid))
          );

          if (!hasFirstChallenge && sessionsSnap.size === 1) {
            await addDoc(collection(db, 'userAchievements'), {
              achievementTypeId: 'first_challenge_completed',
              userId: user.uid,
              obtainedAt: Timestamp.fromDate(new Date()),
            });
            console.log('[ChallengeDetail] Logro "first_challenge_completed" otorgado!');
            useAchievementModalStore.getState().showAchievement(
              'Primer Desafío',
              'Completaste tu primer desafío.'
            );
          } else if (!has7DayStreak) {
            // Verificar racha de 7 días
            const days = new Set<string>();
            sessionsSnap.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.completed === false) return;
              const finished = fromFirestoreDate(data.finishedAt);
              if (finished) {
                const parts = getLogicalDateParts(finished);
                days.add(buildDateKeyFromParts(parts));
              }
            });

            const currentStreak = calculateStreak(Array.from(days));
            if (currentStreak >= 7) {
              await addDoc(collection(db, 'userAchievements'), {
                achievementTypeId: 'streak_7_days',
                userId: user.uid,
                obtainedAt: Timestamp.fromDate(new Date()),
              });
              console.log('[ChallengeDetail] Logro "streak_7_days" otorgado!');
              // Pequeño delay por si también salta el de primer desafío o la app se traba
              setTimeout(() => {
                useAchievementModalStore.getState().showAchievement(
                  'Racha de 7 días',
                  '¡Completaste 7 días seguidos de desafíos!'
                );
              }, 500);
            }
          }
        }
      } catch (achErr) {
        console.error('[ChallengeDetail] NO se pudo otorgar el logro.', achErr);
      }
    } catch (error) {
      console.error('[ChallengeDetail] No se pudo guardar la sesión.', error);
      setSessionError('No pudimos guardar tu desafío. Intenta nuevamente.');
    } finally {
      setSavingSession(false);
    }
  }, [challenge, savingSession, sessionSaved, startedAt, user?.uid]);

  useEffect(() => {
    if (status === 'completed') {
      endAtRef.current = null;
      setActiveChallenge(null);
      persistSession();
      cancelChallengeTimerNotification();
    }
  }, [status, persistSession, setActiveChallenge]);

  const handleStart = async () => {
    if (!challenge) return;
    // Bloquear si hay otro desafío en curso
    if (activeChallengeId !== null && activeChallengeId !== challenge.id) return;

    if (!notifPermGranted.current) {
      notifPermGranted.current = await requestNotificationPermissions();
    }

    const initialSeconds = Math.max(1, challenge.durationMinutes) * 60;
    const endAtMs = Date.now() + initialSeconds * 1000;
    const startedAtMs = Date.now();
    endAtRef.current = endAtMs;

    setRemainingSeconds(initialSeconds);
    setStartedAt(new Date(startedAtMs));
    setStatus('running');
    setSessionSaved(false);
    setSessionError(null);
    setSessionId(null);
    setActiveChallenge(challenge.id, challenge.title);
    setTimerRunning(endAtMs, startedAtMs);

    if (notifPermGranted.current) {
      showChallengeTimerNotification(challenge.title, initialSeconds);
    }
  };

  const handlePause = () => {
    endAtRef.current = null;
    setTimerPaused(remainingSeconds);
    setStatus('paused');
    cancelChallengeTimerNotification();
  };

  const handleResume = () => {
    const newEndAtMs = Date.now() + remainingSeconds * 1000;
    endAtRef.current = newEndAtMs;
    setTimerResumed(newEndAtMs);
    setStatus('running');
    if (challenge?.title && notifPermGranted.current) {
      showChallengeTimerNotification(challenge.title, remainingSeconds);
    }
  };

  const handleCancel = () => {
    endAtRef.current = null;
    setStatus('idle');
    setRemainingSeconds(0);
    setStartedAt(null);
    setSessionError(null);
    setSessionId(null);
    setActiveChallenge(null);
    cancelChallengeTimerNotification();
  };

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(main)/home');
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
      {status !== 'completed' && (
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={24} color="#282828" />
        </Pressable>
      )}
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

          {status === 'running' || status === 'paused' ? (
            <>
              <Text style={styles.timerText}>{formatTimer(remainingSeconds)}</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={status === 'running' ? handlePause : handleResume}
              >
                <Text style={styles.primaryLabel}>
                  {status === 'running' ? 'Pausar' : 'Reanudar'}
                </Text>
              </Pressable>
              <Pressable style={styles.linkButton} onPress={handleCancel}>
                <Text style={styles.linkLabel}>Cancelar</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.durationLabel}>
              Duración: {challenge.durationMinutes} minutos
            </Text>
          )}

          {status === 'idle' && (() => {
            const isBlocked = activeChallengeId !== null && activeChallengeId !== challenge.id;
            return (
              <Pressable
                style={[styles.primaryButton, isBlocked && styles.primaryButtonDisabled]}
                onPress={isBlocked ? undefined : handleStart}
                accessibilityState={{ disabled: isBlocked }}
              >
                <Text style={styles.primaryLabel}>
                  {isBlocked ? 'Otro desafío en curso' : 'Comenzar'}
                </Text>
              </Pressable>
            );
          })()}

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

              <Pressable style={styles.linkButton} onPress={() => router.replace('/(main)/home')}>
                <Text style={styles.linkLabel}>Volver al Inicio</Text>
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
    padding: 8,
    marginLeft: -8,
    marginTop: 4,
    alignSelf: 'flex-start',
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
