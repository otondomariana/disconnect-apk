import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useAuthStore } from '@/stores/auth';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  if (!initialized) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  if (!user) return <Redirect href="/welcome" />;
  return <Redirect href="/(main)/home" />;
}
