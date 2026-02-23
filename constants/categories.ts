import { Ionicons } from '@expo/vector-icons';

export type CategoryKey =
  | 'aire-libre'
  | 'bienestar'
  | 'movimiento'
  | 'conexion'
  | 'creatividad'
  | 'reflexion'
  | 'recreativo'
  | 'lectura';

export type CategoryConfig = {
  key: CategoryKey;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
};

export const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  'aire-libre': {
    key: 'aire-libre',
    label: 'Aire libre',
    iconName: 'leaf',
  },
  bienestar: {
    key: 'bienestar',
    label: 'Bienestar',
    iconName: 'sunny',
  },
  movimiento: {
    key: 'movimiento',
    label: 'Movimiento',
    iconName: 'walk',
  },
  conexion: {
    key: 'conexion',
    label: 'Conexión',
    iconName: 'heart',
  },
  creatividad: {
    key: 'creatividad',
    label: 'Creatividad',
    iconName: 'color-palette',
  },
  reflexion: {
    key: 'reflexion',
    label: 'Reflexión',
    iconName: 'pencil',
  },
  recreativo: {
    key: 'recreativo',
    label: 'Recreativo',
    iconName: 'extension-puzzle',
  },
  lectura: {
    key: 'lectura',
    label: 'Lectura',
    iconName: 'library',
  },
};

export const DEFAULT_CATEGORY_KEYS: CategoryKey[] = [
  'aire-libre',
  'bienestar',
  'movimiento',
  'conexion',
  'creatividad',
  'reflexion',
  'recreativo',
  'lectura',
];

export const normalizeCategoryKey = (raw: string): CategoryKey | undefined => {
  const base = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

  return DEFAULT_CATEGORY_KEYS.find((key) => key === base);
};

