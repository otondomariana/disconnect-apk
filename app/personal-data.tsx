import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COUNTRIES } from '@/constants/countries';
import { auth } from '@/lib/firebase';
import { saveUserProfile } from '@/lib/user-profile';

const PRIMARY = '#039EA2';

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

const getDefaultBirthDate = (): DateParts => {
  const today = new Date();
  return { year: today.getFullYear() - 18, month: 0, day: 1 };
};

const parseBirthDate = (value: string): DateParts | null => {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
};

const formatBirthDate = (date: DateParts) => {
  const month = String(date.month + 1).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
};

const formatDisplayBirthDate = (value: string) => {
  const parsed = parseBirthDate(value);
  if (!parsed) return value;
  const month = String(parsed.month + 1).padStart(2, '0');
  const day = String(parsed.day).padStart(2, '0');
  return `${day}/${month}/${parsed.year}`;
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const clampDay = (year: number, month: number, day: number) => {
  const max = getDaysInMonth(year, month);
  return Math.min(day, max);
};

type Params = {
  mode?: string;
  email?: string;
  password?: string;
};

export default function PersonalDataScreen() {
  const params = useLocalSearchParams<Params>();

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('');
  const [birthDateModalVisible, setBirthDateModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<DateParts>(() => getDefaultBirthDate());
  const [loading, setLoading] = useState(false);

  const mode = params.mode ?? 'google';
  const emailParam = params.email ?? '';
  const passwordParam = params.password ?? '';

  const isGoogleFlow = useMemo(() => mode === 'google', [mode]);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 120 }, (_, index) => currentYear - index);
  }, []);
  const dayOptions = useMemo(
    () => Array.from({ length: getDaysInMonth(tempDate.year, tempDate.month) }, (_, index) => index + 1),
    [tempDate.month, tempDate.year]
  );

  const openBirthDatePicker = useCallback(() => {
    const parsed = parseBirthDate(birthDate);
    setTempDate(parsed ?? getDefaultBirthDate());
    setBirthDateModalVisible(true);
  }, [birthDate]);

  const handleSelectYear = useCallback((year: number) => {
    setTempDate((prev) => ({
      ...prev,
      year,
      day: clampDay(year, prev.month, prev.day),
    }));
  }, []);

  const handleSelectMonth = useCallback((month: number) => {
    setTempDate((prev) => ({
      ...prev,
      month,
      day: clampDay(prev.year, month, prev.day),
    }));
  }, []);

  const handleSelectDay = useCallback((day: number) => {
    setTempDate((prev) => ({ ...prev, day }));
  }, []);

  const handleConfirmBirthDate = useCallback(() => {
    setBirthDate(formatBirthDate(tempDate));
    setBirthDateModalVisible(false);
  }, [tempDate]);

  const handleSelectCountry = useCallback((value: string) => {
    setCountry(value);
    setCountryModalVisible(false);
  }, []);

  const closeBirthDatePicker = useCallback(() => setBirthDateModalVisible(false), []);
  const openCountryPicker = useCallback(() => setCountryModalVisible(true), []);
  const closeCountryPicker = useCallback(() => setCountryModalVisible(false), []);

  const birthDateDisplay = useMemo(
    () => (birthDate ? formatDisplayBirthDate(birthDate) : 'Fecha de nacimiento'),
    [birthDate]
  );

  const renderCountryItem = useCallback(
    ({ item }: { item: string }) => {
      const selected = country === item;
      return (
        <Pressable
          onPress={() => handleSelectCountry(item)}
          style={[styles.countryItem, selected && styles.countryItemSelected]}
        >
          <Text style={selected ? styles.countryItemLabelSelected : styles.countryItemLabel}>{item}</Text>
        </Pressable>
      );
    },
    [country, handleSelectCountry]
  );

  const countryKeyExtractor = useCallback((item: string) => item, []);

  const handleBack = useCallback(() => {
    if (isGoogleFlow) router.replace('/welcome');
    else router.back();
  }, [isGoogleFlow]);

  const handleContinue = useCallback(async () => {
    if (!name || !birthDate || !country) {
      Alert.alert('Datos personales', 'Completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      let user = auth.currentUser;

      if (!isGoogleFlow) {
        if (!emailParam || !passwordParam) {
          throw new Error('Faltan las credenciales para crear la cuenta.');
        }
        const normalizedEmail = emailParam.trim().toLowerCase();
        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, passwordParam);
        user = credential.user;
      }

      if (!user) {
        throw new Error('No se pudo obtener el usuario autenticado.');
      }

      await Promise.all([
        updateProfile(user, { displayName: name }).catch(() => undefined),
        saveUserProfile(user, {
          displayName: name,
          birthDate,
          country,
          email: user.email ?? emailParam,
        }),
      ]);

      router.replace('/(main)/home');
    } catch (error: any) {
      const message = error?.message ?? 'No se pudo guardar la información.';
      Alert.alert('Datos personales', message);
    } finally {
      setLoading(false);
    }
  }, [birthDate, country, emailParam, isGoogleFlow, name, passwordParam]);

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable accessibilityLabel="Volver" onPress={handleBack} style={styles.backButton}>
              <Ionicons color={PRIMARY} name="arrow-back" size={24} />
            </Pressable>
            <Text style={styles.title}>Complete los siguientes datos para continuar</Text>
          </View>

        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require('../assets/images/Meditation-bro.png')}
          style={styles.illustration}
        />

        <TextInput
          onChangeText={setName}
          placeholder="Alias"
          placeholderTextColor="#9B9B9B"
            style={styles.input}
            value={name}
          />
          <Pressable
            accessibilityLabel="Seleccionar fecha de nacimiento"
            disabled={loading}
            onPress={openBirthDatePicker}
            style={[styles.selectInput, loading && styles.disabled]}
          >
            <Text style={birthDate ? styles.selectValue : styles.selectPlaceholder}>{birthDateDisplay}</Text>
            <Ionicons color="#9B9B9B" name="calendar" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Seleccionar país"
            disabled={loading}
            onPress={openCountryPicker}
            style={[styles.selectInput, loading && styles.disabled]}
          >
            <Text style={country ? styles.selectValue : styles.selectPlaceholder}>{country || 'País'}</Text>
            <Ionicons color="#9B9B9B" name="chevron-down" size={20} />
          </Pressable>

          <Pressable disabled={loading} onPress={handleContinue} style={[styles.primaryButton, loading && styles.disabled]}>
            <Text style={styles.primaryLabel}>Continuar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        onRequestClose={closeBirthDatePicker}
        transparent
        visible={birthDateModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona tu fecha de nacimiento</Text>
            <View style={styles.pickerColumns}>
              <ScrollView
                contentContainerStyle={styles.pickerColumnContent}
                showsVerticalScrollIndicator={false}
                style={styles.pickerColumn}
              >
                {yearOptions.map((year) => {
                  const selected = tempDate.year === year;
                  return (
                    <Pressable
                      key={year}
                      onPress={() => handleSelectYear(year)}
                      style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                    >
                      <Text style={selected ? styles.pickerOptionLabelSelected : styles.pickerOptionLabel}>{year}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView
                contentContainerStyle={styles.pickerColumnContent}
                showsVerticalScrollIndicator={false}
                style={styles.pickerColumn}
              >
                {MONTHS.map((label, index) => {
                  const selected = tempDate.month === index;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => handleSelectMonth(index)}
                      style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                    >
                      <Text style={selected ? styles.pickerOptionLabelSelected : styles.pickerOptionLabel}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView
                contentContainerStyle={styles.pickerColumnContent}
                showsVerticalScrollIndicator={false}
                style={styles.pickerColumn}
              >
                {dayOptions.map((day) => {
                  const selected = tempDate.day === day;
                  return (
                    <Pressable
                      key={day}
                      onPress={() => handleSelectDay(day)}
                      style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                    >
                      <Text style={selected ? styles.pickerOptionLabelSelected : styles.pickerOptionLabel}>{day}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.modalButtons}>
              <Pressable onPress={closeBirthDatePicker} style={styles.secondaryButton}>
                <Text style={styles.secondaryLabel}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleConfirmBirthDate} style={[styles.primaryButton, styles.modalPrimaryButton]}>
                <Text style={styles.primaryLabel}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={closeCountryPicker} visible={countryModalVisible}>
        <View style={styles.countryModal}>
          <View style={styles.countryHeader}>
            <Text style={styles.modalTitle}>Selecciona tu país</Text>
            <Pressable accessibilityLabel="Cerrar" onPress={closeCountryPicker} style={styles.closeButton}>
              <Ionicons color={PRIMARY} name="close" size={24} />
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.countryList}
            data={COUNTRIES}
            keyExtractor={countryKeyExtractor}
            renderItem={renderCountryItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: 999,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: PRIMARY,
    marginTop: 12,
  },
  illustration: {
    width: '100%',
    height: 220,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E5E7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    color: '#1F2933',
  },
  selectInput: {
    borderWidth: 1,
    borderColor: '#E0E5E7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectPlaceholder: {
    color: '#9B9B9B',
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
  },
  selectValue: {
    color: '#1F2933',
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: PRIMARY,
    textAlign: 'center',
  },
  pickerColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerColumn: {
    flex: 1,
    maxHeight: 220,
  },
  pickerColumnContent: {
    gap: 10,
    paddingVertical: 6,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: '#E0E5E7',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerOptionSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#E6F3F4',
  },
  pickerOptionLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    color: '#1F2933',
  },
  pickerOptionLabelSelected: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: PRIMARY,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E5E7',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 15,
    color: '#1F2933',
  },
  modalPrimaryButton: {
    flex: 1,
  },
  countryModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeButton: {
    padding: 8,
  },
  countryList: {
    paddingBottom: 24,
  },
  countryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E5E7',
  },
  countryItemSelected: {
    backgroundColor: '#E6F3F4',
  },
  countryItemLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    color: '#1F2933',
  },
  countryItemLabelSelected: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: PRIMARY,
  },
});
