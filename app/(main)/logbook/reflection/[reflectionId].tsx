import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatLongDate, formatTime, fromFirestoreDate } from '@/lib/date';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth';

type ReflectionData = {
  id: string;
  text: string;
  isPublic: boolean;
  isAnonymous: boolean;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

const PRIMARY = '#039EA2';

export default function ReflectionDetailScreen() {
  const { reflectionId } = useLocalSearchParams<{ reflectionId?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReflection = async () => {
      if (!reflectionId || !user?.uid) return;
      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, 'reflections', reflectionId));
        if (!snap.exists()) {
          setError('No encontramos esta reflexión.');
          return;
        }
        const data = snap.data() as {
          text?: string;
          isPublic?: boolean;
          isAnonymous?: boolean;
          active?: boolean;
          createdAt?: unknown;
          updatedAt?: unknown;
          userId?: string;
        };
        if (data.userId && data.userId !== user.uid) {
          setError('No puedes ver esta reflexión.');
          return;
        }
        if (!cancelled) {
          setReflection({
            id: snap.id,
            text: data.text?.toString() ?? '',
            isPublic: Boolean(data.isPublic),
            isAnonymous: Boolean(data.isAnonymous),
            active: data.active !== false,
            createdAt: fromFirestoreDate(data.createdAt),
            updatedAt: fromFirestoreDate(data.updatedAt),
          });
        }
      } catch (err) {
        console.error('[ReflectionDetail] No pudimos cargar la reflexión.', err);
        if (!cancelled) setError('No pudimos cargar la reflexión. Intenta nuevamente.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadReflection();
    return () => {
      cancelled = true;
    };
  }, [reflectionId, user?.uid]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/logbook');
    }
  };

  const handleEditPlaceholder = () => {
    Alert.alert('Próximamente', 'La edición de reflexiones estará disponible más adelante.');
  };

  if (loading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  if (error || !reflection) {
    return (
      <View style={styles.fullCenter}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={22} color={PRIMARY} />
          <Text style={styles.backLabel}>Volver</Text>
        </Pressable>
        <Text style={styles.errorText}>{error ?? 'No encontramos esta reflexión.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable style={styles.backButton} onPress={handleGoBack}>
        <Ionicons name="chevron-back" size={22} color={PRIMARY} />
        <Text style={styles.backLabel}>Volver</Text>
      </Pressable>

      <Text style={styles.title}>Tu reflexión</Text>
      <View style={styles.statusRow}>
        <Text style={styles.statusBadge}>
          {reflection.isPublic ? 'Publicada' : 'Privada'}
        </Text>
        {reflection.isPublic && (
          <Text style={styles.statusBadge}>
            {reflection.isAnonymous ? 'Anónima' : 'Con tu nombre'}
          </Text>
        )}
        {reflection.active ? null : <Text style={styles.statusBadge}>Archivada</Text>}
      </View>

      <View style={styles.meta}>
        {reflection.updatedAt && (
          <Text style={styles.metaText}>
            Última actualización: {formatLongDate(reflection.updatedAt)} {formatTime(reflection.updatedAt)}
          </Text>
        )}
        {!reflection.updatedAt && reflection.createdAt && (
          <Text style={styles.metaText}>
            Creada el {formatLongDate(reflection.createdAt)} {formatTime(reflection.createdAt)}
          </Text>
        )}
      </View>

      <View style={styles.contentCard}>
        <Text style={styles.reflectionText}>{reflection.text || 'Sin contenido.'}</Text>
      </View>

      <Pressable style={styles.editButton} onPress={handleEditPlaceholder}>
        <Ionicons name="create-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.editLabel}>Editar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  fullCenter: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backLabel: {
    marginLeft: 4,
    color: PRIMARY,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#0F4D4F',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#D6EFEF',
    color: '#0F4D4F',
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  meta: {
    marginBottom: 16,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#6E6E6E',
  },
  contentCard: {
    borderWidth: 1,
    borderColor: '#E0E5E7',
    borderRadius: 20,
    padding: 16,
    minHeight: 200,
    marginBottom: 24,
  },
  reflectionText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
    lineHeight: 24,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  editLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
  },
});
