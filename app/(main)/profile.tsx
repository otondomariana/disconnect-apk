import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState<string>('');
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [stats, setStats] = useState({ challenges: 0, achievements: 0, reflections: 0 });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadStats = async () => {
        if (!user?.uid) {
          if (active) setLoadingStats(false);
          return;
        }
        try {
          const snap = await getDocs(query(collection(db, 'challengeSessions'), where('userId', '==', user.uid)));
          let totalChallenges = 0;
          let totalAchievements = 0;
          let totalReflections = 0;

          try {
            const achievementsSnap = await getDocs(query(collection(db, 'userAchievements'), where('userId', '==', user.uid)));
            totalAchievements = achievementsSnap.size;
          } catch (e) {
            console.error('[Profile] Error loading user achievements', e);
          }

          try {
            const reflectionsSnap = await getDocs(query(collection(db, 'reflections'), where('userId', '==', user.uid)));
            totalReflections = reflectionsSnap.size;
          } catch (e) {
            console.error('[Profile] Error loading user reflections', e);
          }

          // Convertimos a array para usar for...of con await
          const docs = snap.docs;

          for (const docSnap of docs) {
            const data = docSnap.data();
            if (data.completed === false) continue;

            totalChallenges += 1;
          }

          if (active) {
            setStats({
              challenges: totalChallenges,
              achievements: totalAchievements,
              reflections: totalReflections,
            });
          }
        } catch (error) {
          console.error('[Profile] Error loading stats', error);
        } finally {
          if (active) setLoadingStats(false);
        }
      };

      loadStats();
      return () => {
        active = false;
      };
    }, [user?.uid])
  );

  useEffect(() => {
    let active = true;

    const loadName = async () => {
      const fallback = auth.currentUser?.displayName ?? '';
      try {
        if (!user) {
          if (active) setDisplayName(fallback);
          return;
        }

        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? (snap.data() as { displayName?: string; name?: string }) : undefined;
        const storedName = data?.displayName ?? data?.name;
        if (active) {
          setDisplayName(storedName?.trim() || fallback || '');
        }
      } catch {
        if (active) setDisplayName(fallback || '');
      }
    };

    loadName();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const avatarText = useMemo(() => {
    if (displayName) return displayName.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return '?';
  }, [displayName, user?.email]);

  const handleSignOut = async () => {
    if (signingOut) return;

    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro/a de que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await auth.signOut();
            } catch (error) {
              Alert.alert('Error', 'No pudimos cerrar sesión. Intenta nuevamente.');
              console.error('[Profile] signOut error', error);
            } finally {
              setSigningOut(false);
            }
          }
        }
      ]
    );
  };

  const renderMenuItem = (icon: keyof typeof Ionicons.glyphMap, label: string, color: string = '#282828', onPress?: () => void) => (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: color === '#D64545' ? '#FCE8E8' : '#F0F5F5' }]}>
        <Ionicons name={icon} size={20} color={color === '#D64545' ? '#D64545' : '#039EA2'} />
      </View>
      <Text style={[styles.menuItemLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{avatarText}</Text>
          </View>
          <Text style={styles.nameText}>{displayName || 'Usuario Disconnect'}</Text>
          <Text style={styles.emailText}>{user?.email || 'Sin correo vinculado'}</Text>
        </View>

        <View style={styles.statsSection}>
          <Pressable
            style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/my-reflections')}
          >
            <Ionicons name="document-text" size={24} color="#039EA2" />
            {loadingStats ? (
              <ActivityIndicator color="#039EA2" size="small" style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.statValue}>{stats.reflections}</Text>
            )}
            <Text style={styles.statLabel}>Reflexiones</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/completed-challenges')}
          >
            <Ionicons name="flag" size={24} color="#039EA2" />
            {loadingStats ? (
              <ActivityIndicator color="#039EA2" size="small" style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.statValue}>{stats.challenges}</Text>
            )}
            <Text style={styles.statLabel}>Desafíos</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/achievements')}
          >
            <Ionicons name="trophy" size={24} color="#FBC02D" />
            {loadingStats ? (
              <ActivityIndicator color="#039EA2" size="small" style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.statValue}>{stats.achievements}</Text>
            )}
            <Text style={styles.statLabel}>Logros</Text>
          </Pressable>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Ajustes</Text>
          <View style={styles.menuCard}>
            {renderMenuItem('notifications-outline', 'Notificaciones')}
            <View style={styles.divider} />
            {renderMenuItem('lock-closed-outline', 'Privacidad y Seguridad', '#282828', () => router.push('/privacy-security'))}
            <View style={styles.divider} />
            {renderMenuItem('color-palette-outline', 'Apariencia')}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Soporte</Text>
          <View style={styles.menuCard}>
            {renderMenuItem('help-circle-outline', 'Centro de Ayuda')}
            <View style={styles.divider} />
            {renderMenuItem('information-circle-outline', 'Acerca de Disconnect')}
          </View>
        </View>

        <View style={styles.logoutSection}>
          {signingOut ? (
            <ActivityIndicator color="#D64545" />
          ) : (
            <Pressable
              style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={20} color="#D64545" />
              <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFA', // Fondo ligeramente gris/celeste muy claro para contrastar las tarjetas
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#039EA2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#039EA2',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
  },
  nameText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#6E6E6E',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
    marginTop: 4,
    textAlign: 'center',
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuItemPressed: {
    opacity: 0.6,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F5F5',
    marginLeft: 56,
  },
  logoutSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE8E8',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 20,
    width: '100%',
    gap: 8,
  },
  logoutButtonPressed: {
    opacity: 0.8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#D64545',
  },
});
