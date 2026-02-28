import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const { reflectionId, origin } = useLocalSearchParams<{ reflectionId?: string; origin?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado de edición
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
          const r: ReflectionData = {
            id: snap.id,
            text: data.text?.toString() ?? '',
            isPublic: Boolean(data.isPublic),
            isAnonymous: Boolean(data.isAnonymous),
            active: data.active !== false,
            createdAt: fromFirestoreDate(data.createdAt),
            updatedAt: fromFirestoreDate(data.updatedAt),
          };
          setReflection(r);
          setEditedText(r.text);
        }
      } catch (err) {
        console.error('[ReflectionDetail] No pudimos cargar la reflexión.', err);
        if (!cancelled) setError('No pudimos cargar la reflexión. Intenta nuevamente.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadReflection();
    return () => { cancelled = true; };
  }, [reflectionId, user?.uid]);

  const handleGoBack = () => {
    if (origin === 'my-reflections') {
      if (router.canGoBack()) router.back();
      else router.replace('/my-reflections');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/logbook');
    }
  };

  const handleStartEdit = () => {
    // Inicializar los switches con los valores actuales
    setEditIsPublic(reflection?.isPublic ?? false);
    setEditIsAnonymous(reflection?.isAnonymous ?? false);
    setEditing(true);
    setSaveError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleTogglePublic = (value: boolean) => {
    setEditIsPublic(value);
    if (!value) setEditIsAnonymous(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedText(reflection?.text ?? '');
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!reflectionId || !reflection) return;
    const trimmed = editedText.trim();
    if (!trimmed) {
      setSaveError('La reflexión no puede estar vacía.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const now = new Date();
      await updateDoc(doc(db, 'reflections', reflectionId), {
        text: trimmed,
        isPublic: editIsPublic,
        isAnonymous: editIsPublic ? editIsAnonymous : false,
        updatedAt: now,
      });
      setReflection((prev) => prev ? {
        ...prev,
        text: trimmed,
        isPublic: editIsPublic,
        isAnonymous: editIsPublic ? editIsAnonymous : false,
        updatedAt: now,
      } : prev);
      setEditing(false);
    } catch (err) {
      console.error('[ReflectionDetail] Error guardando.', err);
      setSaveError('No pudimos guardar los cambios. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar reflexión',
      '¿Estás seguro de que deseas eliminar esta reflexión? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!reflectionId) return;
            setDeleting(true);
            try {
              await deleteDoc(doc(db, 'reflections', reflectionId));
              if (origin === 'my-reflections') {
                if (router.canGoBack()) router.back();
                else router.replace('/my-reflections');
              } else if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(main)/logbook');
              }
            } catch (err) {
              console.error('[ReflectionDetail] Error al eliminar:', err);
              Alert.alert('Error', 'No pudimos eliminar la reflexión. Intenta nuevamente.');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={24} color="#282828" />
          </Pressable>
          <Text style={styles.headerTitle}>Tu reflexión</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !reflection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={24} color="#282828" />
          </Pressable>
          <Text style={styles.headerTitle}>Tu reflexión</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'No encontramos esta reflexión.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayDate = reflection.updatedAt ?? reflection.createdAt;
  const dateLabel = reflection.updatedAt ? 'Última actualización' : 'Creada el';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleGoBack} disabled={editing && saving}>
          <Ionicons name="chevron-back" size={24} color="#282828" />
        </Pressable>
        <Text style={styles.headerTitle}>Tu reflexión</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Badges de estado */}
        <View style={styles.statusRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{reflection.isPublic ? 'Publicada' : 'Privada'}</Text>
          </View>
          {reflection.isPublic && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {reflection.isAnonymous ? 'Anónima' : 'Con tu nombre'}
              </Text>
            </View>
          )}
          {!reflection.active && (
            <View style={[styles.badge, styles.badgeMuted]}>
              <Text style={[styles.badgeText, styles.badgeMutedText]}>Archivada</Text>
            </View>
          )}
        </View>

        {/* Fecha */}
        {displayDate && (
          <Text style={styles.metaText}>
            {dateLabel}: {formatLongDate(displayDate)} {formatTime(displayDate)}
          </Text>
        )}

        {/* Cuerpo de la reflexión */}
        {editing ? (
          <>
            <TextInput
              ref={inputRef}
              style={styles.textInputCard}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              textAlignVertical="top"
              placeholder="Escribe tu reflexión..."
              placeholderTextColor="#A0A0A0"
            />

            {/* Switch: compartir con la comunidad */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrapper}>
                <Text style={styles.switchTitle}>Compartir con la comunidad</Text>
                <Text style={styles.switchSubtitle}>Otros usuarios podrán leer tu reflexión.</Text>
              </View>
              <Switch
                value={editIsPublic}
                onValueChange={handleTogglePublic}
                trackColor={{ false: '#D1D5DB', true: '#7FD5D7' }}
                thumbColor={editIsPublic ? PRIMARY : '#F4F4F5'}
              />
            </View>

            {/* Switch: anónima */}
            <View style={[styles.switchRow, !editIsPublic && styles.switchRowDisabled]}>
              <View style={styles.switchTextWrapper}>
                <Text style={styles.switchTitle}>Publicar como anónima</Text>
                <Text style={styles.switchSubtitle}>Oculta tu nombre para mantener tu privacidad.</Text>
              </View>
              <Switch
                value={editIsAnonymous}
                onValueChange={setEditIsAnonymous}
                disabled={!editIsPublic}
                trackColor={{ false: '#D1D5DB', true: '#7FD5D7' }}
                thumbColor={editIsPublic && editIsAnonymous ? PRIMARY : '#F4F4F5'}
              />
            </View>
          </>
        ) : (
          <View style={styles.contentCard}>
            <Text style={styles.reflectionText}>{reflection.text || 'Sin contenido.'}</Text>
          </View>
        )}

        {/* Error de guardado */}
        {saveError && (
          <Text style={styles.saveErrorText}>{saveError}</Text>
        )}

        {/* Acciones */}
        {editing ? (
          <View style={styles.editActions}>
            <View style={styles.saveDeleteRow}>
              <Pressable
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                }
                <Text style={styles.saveButtonLabel}>{saving ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>

              <Pressable
                style={[styles.deleteActionButton, deleting && styles.buttonDisabled]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color="#D64545" size="small" />
                  : <Ionicons name="trash-outline" size={20} color="#D64545" />
                }
              </Pressable>
            </View>

            <Pressable
              style={[styles.cancelButton, (saving || deleting) && styles.buttonDisabled]}
              onPress={handleCancelEdit}
              disabled={saving || deleting}
            >
              <Text style={styles.cancelButtonLabel}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.editButton} onPress={handleStartEdit}>
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.editLabel}>Editar</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F5',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#282828',
  },
  headerRight: { width: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
    textAlign: 'center',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#D6EFEF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    color: '#0F4D4F',
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
  },
  badgeMuted: {
    backgroundColor: '#F0F0F0',
  },
  badgeMutedText: {
    color: '#6E6E6E',
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#6E6E6E',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E5E7',
    padding: 20,
    minHeight: 200,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reflectionText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
    lineHeight: 26,
  },
  textInputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    padding: 20,
    minHeight: 200,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1F2933',
    lineHeight: 26,
  },
  saveErrorText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#D64545',
    textAlign: 'center',
  },
  editActions: {
    gap: 12,
  },
  saveDeleteRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 18,
  },
  deleteActionButton: {
    backgroundColor: '#FCE8E8',
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F8CACA',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E5E7',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonLabel: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#6E6E6E',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F5F5',
  },
  switchRowDisabled: {
    opacity: 0.45,
  },
  switchTextWrapper: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#1F2933',
  },
  switchSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#6E6E6E',
    marginTop: 3,
  },
});
