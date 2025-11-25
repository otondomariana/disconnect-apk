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
  image: any;
};

export const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  'aire-libre': {
    key: 'aire-libre',
    label: 'Aire libre',
    image: require('@/assets/images/aire-libre.png'),
  },
  bienestar: {
    key: 'bienestar',
    label: 'Bienestar',
    image: require('@/assets/images/bienestar.png'),
  },
  movimiento: {
    key: 'movimiento',
    label: 'Movimiento',
    image: require('@/assets/images/movimiento.png'),
  },
  conexion: {
    key: 'conexion',
    label: 'Conexión',
    image: require('@/assets/images/conexion.png'),
  },
  creatividad: {
    key: 'creatividad',
    label: 'Creatividad',
    image: require('@/assets/images/creatividad.png'),
  },
  reflexion: {
    key: 'reflexion',
    label: 'Reflexión',
    image: require('@/assets/images/reflexion.png'),
  },
  recreativo: {
    key: 'recreativo',
    label: 'Recreativo',
    image: require('@/assets/images/recreativo.png'),
  },
  lectura: {
    key: 'lectura',
    label: 'Lectura',
    image: require('@/assets/images/lectura.png'),
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

