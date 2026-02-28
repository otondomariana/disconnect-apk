// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// añadidos
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(main)',
};

// Un solo QueryClient para toda la app
const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  // Listener de Firebase Auth -> guarda el usuario en Zustand
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser: User | null) => {
      const current = useAuthStore.getState();
      if (current.user === fbUser && current.initialized) {
        return;
      }
      useAuthStore.setState({ user: fbUser, initialized: true });
    });
    return () => unsub();
  }, []);

  // Global Auth Guard
  useEffect(() => {
    if (!initialized || !rootNavigationState?.key) return;

    const inAuthGroup = (segments[0] as string) === '(auth)';
    const isPersonalData = segments[0] === 'personal-data';

    if (user && inAuthGroup) {
      // User is signed in and trying to access an auth screen -> redirect to home
      router.replace('/(main)/home');
    } else if (!user && !inAuthGroup && !isPersonalData) {
      // User is not signed in and trying to access a protected screen -> redirect to welcome
      router.replace('/welcome');
    }
  }, [user, initialized, segments, rootNavigationState?.key]);

  // Carga de fuentes globales
  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Medium': require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-Bold': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
    'PlusJakartaSans-Light': require('../assets/fonts/PlusJakartaSans-Light.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: 'white' }} />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            {/* Tu navegación existente se mantiene */}
            <Stack.Screen name="(main)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="personal-data" options={{ headerShown: false }} />
            <Stack.Screen name="achievements" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="completed-challenges" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="my-reflections" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="community" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-security" options={{ headerShown: false }} />

          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
