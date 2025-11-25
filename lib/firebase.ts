// lib/firebase.ts
// Inicializa Firebase leyendo la config desde app.json -> expo.extra.firebase
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getApps, initializeApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

type Extra = {
  firebase?: {
    apiKey: string;
    authDomain?: string;
    projectId: string;
    databaseURL?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId: string;
  };
};

// Intentamos leer de distintas formas según el modo de ejecución
const extra: Extra =
  (Constants.expoConfig?.extra as Extra) ??
  (Constants as any)?.manifest?.extra ??
  (Constants as any)?.manifest2?.extra ??
  {};

if (!extra.firebase) {
  console.warn(
    "[Firebase] No se encontró expo.extra.firebase en app.json. Verificá app.json -> expo.extra.firebase"
  );
}

const firebaseConfig = extra.firebase ?? {};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// En RN usamos initializeAuth con persistencia en AsyncStorage.
// En web usamos getAuth normal.
let authInstance: Auth;
if (Platform.OS !== "web") {
  try {
    // Import dinámico para evitar error de tipos en TS (Bundler resolution)
    // y usar la API RN cuando está disponible en runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require("firebase/auth");
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    console.error('[Firebase] initializeAuth error', e);
    // Si ya fue inicializado, caemos en getAuth(app)
    authInstance = getAuth(app);
  }
} else {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
