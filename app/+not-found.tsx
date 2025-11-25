import { useEffect } from 'react';
import { router } from 'expo-router';

export default function NotFoundRedirect() {
  useEffect(() => {
    // Cae siempre a la pantalla de bienvenida
    router.replace('/welcome');
  }, []);
  return null;
}

