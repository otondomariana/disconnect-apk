import { Ionicons } from '@expo/vector-icons';
import { Tabs, useSegments } from 'expo-router';
import { Platform, View } from 'react-native';

import { AchievementModal } from '@/components/AchievementModal';
import { useAuthStore } from '@/stores/auth';

// Segmentos (nombres de ruta) en los que se debe ocultar la tab bar
// useSegments() retorna los nombres de segmento con corchetes, ej: ['(main)', 'logbook', '[date]']

export default function MainTabs() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const segments = useSegments();

  // Ocultar la tab bar en pantallas de detalle de bitácora y desafío
  // - logbook/[date], logbook/session/[sessionId], logbook/reflection/[reflectionId]
  // - challenge/[challengeId]
  const inLogbookDetail =
    segments.includes('logbook' as never) &&
    (segments.includes('[date]' as never) ||
      segments.includes('session' as never) ||
      segments.includes('[reflectionId]' as never));
  const inChallengeDetail = segments.includes('challenge' as never);
  const inCommunity = segments.includes('community' as never);
  const inAllChallenges = segments.includes('all-challenges' as never);
  const inCategories = segments.includes('categories' as never);
  const inReflection = segments.includes('reflection' as never);
  const hideTabBar = inLogbookDetail || inChallengeDetail || inCommunity || inAllChallenges || inCategories || inReflection;

  const tabBarStyle = hideTabBar
    ? { display: 'none' as const }
    : {
      height: 60,
      paddingHorizontal: 32,
      paddingTop: 8,
      paddingBottom: 16,
      marginBottom: Platform.OS === 'android' ? 24 : 12,
      borderTopWidth: 0.5,
      borderTopColor: '#E0E0E0',
      backgroundColor: '#FFFFFF',
      elevation: 12,
    };

  if (!initialized) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return (
    <>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: '#039EA2',
          tabBarInactiveTintColor: '#A4C3C7',
          tabBarLabelStyle: {
            fontFamily: 'PlusJakartaSans-Medium',
            fontSize: 12,
            marginBottom: Platform.OS === 'ios' ? 8 : 4,
          },
          tabBarItemStyle: {
            paddingTop: 0,
          },
          tabBarStyle,
        }}
      >
        <Tabs.Screen
          name="logbook"
          options={{
            title: 'Bit\u00e1cora',
            tabBarLabel: 'Bit\u00e1cora',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="home"
          options={{
            title: 'Inicio',
            tabBarLabel: 'Inicio',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarLabel: 'Perfil',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="categories/[category]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="challenge/[challengeId]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="reflection/[sessionId]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="all-challenges"
          options={{
            href: null,
          }}
        />

      </Tabs>
      <AchievementModal />
    </>
  );
}
