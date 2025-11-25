import type { ImageSourcePropType } from 'react-native';

import type { CategoryKey } from './categories';

const DEFAULT_CATEGORY: CategoryKey = 'aire-libre';

export const CHALLENGE_ILLUSTRATIONS: Record<CategoryKey, ImageSourcePropType> = {
  'aire-libre': require('@/assets/images/Forest-bro.png'),
  bienestar: require('@/assets/images/Meditation-bro.png'),
  conexion: require('@/assets/images/Pinky-promise-bro.png'),
  creatividad: require('@/assets/images/Making-art-bro.png'),
  lectura: require('@/assets/images/Reading-glasses-bro.png'),
  movimiento: require('@/assets/images/Dumbbell-exercise-bro.png'),
  recreativo: require('@/assets/images/Design-thinking-bro.png'),
  reflexion: require('@/assets/images/Imagination-bro.png'),
};

export const getChallengeIllustration = (category?: CategoryKey): ImageSourcePropType => {
  if (category && CHALLENGE_ILLUSTRATIONS[category]) {
    return CHALLENGE_ILLUSTRATIONS[category];
  }
  return CHALLENGE_ILLUSTRATIONS[DEFAULT_CATEGORY];
};
