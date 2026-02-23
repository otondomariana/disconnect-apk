import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';

export default function NotFoundRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    // Si la ruta no encontrada es el deep link de Google Auth,
    // volvemos atrás para que la pantalla de Login/Register termine el proceso.
    if (pathname.includes('oauth2redirect')) {
      if (router.canGoBack()) {
        router.back();
        return;
      }
    }

    // Cae siempre a la pantalla de bienvenida
    router.replace('/welcome');
  }, [pathname]);

  return null;
}
