import { Link } from 'expo-router';
import { Image, StyleSheet, Text, View, Pressable } from 'react-native';

const PRIMARY = '#039EA2';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 24, width: '100%' }}>
        <Text style={styles.subtitle}>Te damos la bienvenida a</Text>
        <Text style={styles.title}>Disconnect</Text>
      </View>

      <Image
        source={require('../assets/images/Contemplating-bro.png')}
        style={styles.illustration}
        resizeMode="contain"
      />

      <Link href="/register" asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Crear cuenta</Text>
        </Pressable>
      </Link>

      <Text style={styles.mutedText}>¿Ya tienes una cuenta?</Text>

      <Link href="/login" asChild>
        <Pressable>
          <Text style={styles.linkText}>Iniciar sesión</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    gap: 16,
  },
  subtitle: { fontFamily: 'PlusJakartaSans-Medium', color: '#3b3b3b', fontSize: 18, marginTop: 8 },
  title: { fontFamily: 'PlusJakartaSans-Bold', color: PRIMARY, fontSize: 40, marginTop: 8 },
  illustration: { width: 280, height: 280, marginVertical: 8 },
  primaryButton: { backgroundColor: PRIMARY, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 14, width: '88%', alignSelf: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', textAlign: 'center', fontSize: 18, fontFamily: 'PlusJakartaSans-Bold' },
  mutedText: { color: '#9B9B9B', marginTop: 12, fontFamily: 'PlusJakartaSans-Regular' },
  linkText: { color: PRIMARY, fontSize: 16, fontFamily: 'PlusJakartaSans-Medium' },
});

