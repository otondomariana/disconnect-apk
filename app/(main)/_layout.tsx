import { Redirect, Tabs } from 'expo-router';
import { Image, Platform, View } from 'react-native';

import { useAuthStore } from '@/stores/auth';

export default function MainTabs() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  if (!initialized) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  if (!user) return <Redirect href="/welcome" />;

  return (
    <Tabs
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
        tabBarStyle: {
          height: 60,
          paddingHorizontal: 32,
          paddingTop: 8,
          paddingBottom: 16,
          marginBottom: Platform.OS === 'android' ? 24 : 12,
          borderTopWidth: 0.5,
          borderTopColor: '#E0E0E0',
          backgroundColor: '#FFFFFF',
          elevation: 12,
        },
      }}
    >
      <Tabs.Screen
        name="logbook"
        options={{
          title: 'Bit\u00e1cora',
          tabBarLabel: 'Bit\u00e1cora',
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('@/assets/images/bitacora.png')}
              style={{
                width: 28,
                height: 28,
                resizeMode: 'contain',
                tintColor: focused ? '#039EA2' : '#A4C3C7',
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Inicio',
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('@/assets/images/inicio.png')}
              style={{
                width: 28,
                height: 28,
                resizeMode: 'contain',
                tintColor: focused ? '#039EA2' : '#A4C3C7',
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('@/assets/images/perfil.png')}
              style={{
                width: 28,
                height: 28,
                resizeMode: 'contain',
                tintColor: focused ? '#039EA2' : '#A4C3C7',
              }}
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
    </Tabs>
  );
}
