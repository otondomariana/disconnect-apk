const LOCALE = 'es-AR';
const TIMEZONE = 'America/Argentina/Buenos_Aires';

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dayNumberFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: 'numeric',
});

export const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
  parts.find((p) => p.type === type)?.value ?? '';

// Zona lógica fija (UTC-3) para todas las claves y comparaciones.
export const LOGICAL_OFFSET_MINUTES = -180;

export const getLogicalDateParts = (date: Date, offsetMinutes: number = LOGICAL_OFFSET_MINUTES) => {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
};

const pad2 = (value: number) => String(value).padStart(2, '0');

export const buildDateKeyFromParts = (parts: { year: number; month: number; day: number }) => {
  return `${parts.year}-${pad2(parts.month + 1)}-${pad2(parts.day)}`;
};

// Conservamos la firma para usos existentes, pero solo construimos la clave a partir de Y/M/D lógicos.
export const formatDateKey = (date: Date, offsetMinutes: number = LOGICAL_OFFSET_MINUTES) => {
  const parts = getLogicalDateParts(date, offsetMinutes);
  return buildDateKeyFromParts(parts);
};

export const parseDateKey = (key: string | undefined | null) => {
  if (!key) return null;
  const [yearStr, monthStr, dayStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  // Use noon UTC to avoid timezone shifts.
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

export const formatLongDate = (date: Date | null | undefined) => {
  if (!date) return '';
  return longDateFormatter.format(date);
};

export const formatTime = (date: Date | null | undefined) => {
  if (!date) return '';
  return timeFormatter.format(date);
};

export const formatDayNumber = (date: Date) => {
  return dayNumberFormatter.format(date);
};

export const fromFirestoreDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const converted = (value as { toDate: () => Date }).toDate();
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted;
      }
    } catch {
      // ignore
    }
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
};

export const formatDisplayBirthDate = (value: string) => {
  const parsed = parseBirthDate(value);
  if (!parsed) return value;
  const month = String(parsed.month + 1).padStart(2, '0');
  const day = String(parsed.day).padStart(2, '0');
  return `${day}/${month}/${parsed.year}`;
};

const parseBirthDate = (value: string): DateParts | null => {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export const calculateStreak = (dateKeys: string[]): number => {
  const uniqueDays = Array.from(new Set(dateKeys)).sort((a, b) => b.localeCompare(a));
  if (uniqueDays.length === 0) return 0;

  const todayStr = formatDateKey(new Date());
  const todayLogical = parseDateKey(todayStr);
  let yesterdayStr = todayStr;

  if (todayLogical) {
    todayLogical.setUTCDate(todayLogical.getUTCDate() - 1);
    yesterdayStr = buildDateKeyFromParts({
      year: todayLogical.getUTCFullYear(),
      month: todayLogical.getUTCMonth(),
      day: todayLogical.getUTCDate(),
    });
  }

  let currentStreak = 0;
  let checkStr = todayStr;

  if (uniqueDays[0] === todayStr) {
    currentStreak = 1;
  } else if (uniqueDays[0] === yesterdayStr) {
    currentStreak = 1;
    checkStr = yesterdayStr;
  } else {
    return 0; // The streak was lost
  }

  for (let i = 1; i < uniqueDays.length; i++) {
    const dateObj = parseDateKey(checkStr);
    if (!dateObj) break;

    // Use UTC methods because parseDateKey returns noon UTC
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    const prevStr = buildDateKeyFromParts({
      year: dateObj.getUTCFullYear(),
      month: dateObj.getUTCMonth(),
      day: dateObj.getUTCDate()
    });

    if (uniqueDays[i] === prevStr) {
      currentStreak++;
      checkStr = prevStr;
    } else {
      break;
    }
  }

  return currentStreak;
};
