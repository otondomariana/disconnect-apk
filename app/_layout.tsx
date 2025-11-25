// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// añadidos
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { View } from 'react-native';

export const unstable_settings = {
  anchor: '(main)',
};

// Un solo QueryClient para toda la app
const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="personal-data" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
