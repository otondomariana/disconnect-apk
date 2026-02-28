import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buildDateKeyFromParts,
  calculateStreak,
  fromFirestoreDate,
  getLogicalDateParts,
  WEEKDAY_LABELS,
} from '@/lib/date';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

type CompletionMap = Record<string, number>;

type CalendarCell = {
  year: number;
  month: number; // 0-based
  day: number;
  key: string;
  dateKey: string | null;
  inCurrentMonth: boolean;
};

const PRIMARY = '#039EA2';

const toMondayIndex = (weekday: number) => (weekday + 6) % 7; // Sunday(0) -> 6, Monday(1) -> 0
const getWeekdayUtc = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day)).getUTCDay(); // deterministic, independent of device tz
const getDaysInMonthUtc = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const buildKey = (year: number, month: number, day: number) =>
  buildDateKeyFromParts({ year, month, day });

const buildCalendarCells = (monthDate: Date): CalendarCell[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = getWeekdayUtc(year, month, 1); // 0=Sun..6=Sat
  const mondayIndex = toMondayIndex(firstWeekday); // 0=Mon..6=Sun
  const daysInMonth = getDaysInMonthUtc(year, month);
  const startDay = 1 - mondayIndex; // numero del dia para la celda 0

  return Array.from({ length: 42 }, (_, index) => {
    const day = startDay + index; // dia lógico que representa la celda
    const inCurrentMonth = day >= 1 && day <= daysInMonth;
    const dateKey = inCurrentMonth ? buildKey(year, month, day) : null;
    const key = dateKey ?? `blank-${year}-${month}-${index}`;

    return {
      year,
      month,
      day,
      key,
      dateKey,
      inCurrentMonth,
    };
  });
};

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export default function LogbookScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [completions, setCompletions] = useState<CompletionMap>({});
  const [loading, setLoading] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  const loadSessions = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'challengeSessions'), where('userId', '==', user.uid)));
      const map: CompletionMap = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() as {
          finishedAt?: unknown;
          completed?: boolean;
        };
        if (data.completed === false) return;
        const finished = fromFirestoreDate(data.finishedAt);
        if (!finished) return;
        const parts = getLogicalDateParts(finished);
        const key = buildDateKeyFromParts(parts); // key estable Y-M-D
        map[key] = (map[key] ?? 0) + 1;
      });
      setCompletions(map);

      // Calcular racha unificada
      const streak = calculateStreak(Object.keys(map));
      setCurrentStreak(streak);

    } catch (error) {
      console.error('[Logbook] No fue posible cargar las sesiones completadas.', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions, refreshFlag]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  useEffect(() => {
    const interval = setInterval(() => setRefreshFlag((prev) => prev + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const calendarCells = useMemo(() => buildCalendarCells(currentMonth), [currentMonth]);

  const monthLabel = useMemo(() => {
    return `${MONTH_LABELS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  }, [currentMonth]);

  const handleChangeMonth = (direction: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const handleSelectDate = (cell: CalendarCell) => {
    if (!cell.inCurrentMonth || !cell.dateKey) return;
    if (!completions[cell.dateKey]) return;
    router.push({
      pathname: '/(main)/logbook/[date]',
      params: { date: cell.dateKey },
    } as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Bitácora</Text>
        <Text style={styles.subtitle}>Mira de un vistazo tus desafios completados.</Text>

        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <Pressable style={styles.monthButton} onPress={() => handleChangeMonth(-1)}>
              <Ionicons name="chevron-back" size={20} color={PRIMARY} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable style={styles.monthButton} onPress={() => handleChangeMonth(1)}>
              <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarCells.map((cell) => {
              const isMarked = cell.inCurrentMonth && cell.dateKey && Boolean(completions[cell.dateKey]);
              return (
                <Pressable
                  key={cell.key}
                  style={styles.dayWrapper}
                  onPress={() => handleSelectDate(cell)}
                  disabled={!cell.inCurrentMonth || !isMarked}
                  android_ripple={{ color: 'rgba(3, 158, 162, 0.15)', borderless: true, radius: 20 }}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isMarked ? styles.dayCircleActive : styles.dayCircleInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        (!cell.inCurrentMonth || !isMarked) && styles.dayLabelMuted,
                      ]}
                    >
                      {cell.inCurrentMonth ? String(cell.day) : ' '}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Text style={styles.helper}>
              Selecciona una fecha marcada para ver los desafios completados ese dia.
            </Text>
            <View style={styles.streakContainer}>
              <View style={styles.streakIconContainer}>
                <Ionicons name="flame" size={24} color="#FF9800" />
              </View>
              <View style={styles.streakTextContainer}>
                <Text style={styles.streakValue}>{currentStreak} {currentStreak === 1 ? 'd\u00eda' : 'd\u00edas'}</Text>
                <Text style={styles.streakLabel}>Racha actual</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#6E6E6E',
    marginBottom: 24,
  },
  calendarCard: {
    backgroundColor: '#F5FAFA',
    borderRadius: 24,
    padding: 16,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthButton: {
    padding: 6,
  },
  monthLabel: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2933',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayWrapper: {
    width: '14.28%', // Valor seguro que evita el desbordamiento
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayCircleActive: {
    backgroundColor: PRIMARY,
  },
  dayCircleInactive: {
    borderRadius: 18,
  },
  dayLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#FFFFFF',
  },
  dayLabelMuted: {
    color: '#9AA5B1',
  },
  helper: {
    marginTop: 24,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#4B5A66',
    textAlign: 'center',
    marginBottom: 24,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0E6', // Fondo naranja muy clarito para la racha
    padding: 16,
    borderRadius: 20,
    alignSelf: 'center',
    width: '100%',
  },
  streakIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE0CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  streakTextContainer: {
    flex: 1,
  },
  streakValue: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#E65100', // Naranja oscuro 
  },
  streakLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#F57C00', // Naranja medio
  },
});
