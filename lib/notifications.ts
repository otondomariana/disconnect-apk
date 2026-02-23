/**
 * notifications.ts
 * Helpers para mostrar/actualizar/cancelar la notificación persistente
 * del temporizador de desafío mientras la app está en background.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Configura el handler global de notificaciones.
 * Debe llamarse una sola vez (idealmente en el entry point de la app,
 * pero también funciona aquí al importar el módulo).
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/** Identifier fijo para la notificación del timer. */
const TIMER_NOTIFICATION_ID = 'challenge-timer';

/** Canal de Android para notificaciones del timer. */
const ANDROID_CHANNEL_ID = 'challenge-timer';

/** Formatea segundos en HH:MM:SS */
const formatTimer = (value: number): string => {
    const safeValue = Math.max(0, value);
    const hours = Math.floor(safeValue / 3600)
        .toString()
        .padStart(2, '0');
    const minutes = Math.floor((safeValue % 3600) / 60)
        .toString()
        .padStart(2, '0');
    const seconds = Math.floor(safeValue % 60)
        .toString()
        .padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

/**
 * Configura el canal de notificaciones en Android (idempotente).
 * Debe llamarse antes de mostrar cualquier notificación.
 */
export async function setupNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Temporizador de desafío',
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
        vibrationPattern: null,
        enableVibrate: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
    });
}

/**
 * Solicita permisos de notificaciones al usuario.
 * @returns true si los permisos fueron concedidos.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

/**
 * Muestra (o actualiza) la notificación persistente del timer.
 * En Android usa `ongoing: true` para que el usuario no pueda cerrarla.
 *
 * @param challengeTitle - Título del desafío activo.
 * @param remainingSeconds - Segundos restantes en el temporizador.
 */
export async function showChallengeTimerNotification(
    challengeTitle: string,
    remainingSeconds: number
): Promise<void> {
    try {
        await Notifications.scheduleNotificationAsync({
            identifier: TIMER_NOTIFICATION_ID,
            content: {
                title: `⏱ ${challengeTitle}`,
                body: `Tiempo restante: ${formatTimer(remainingSeconds)}`,
                sticky: true,          // Android: notificación "ongoing" (no se puede cerrar)
                autoDismiss: false,
                data: { type: 'challenge-timer' },
                ...(Platform.OS === 'android' && {
                    // En Android necesitamos especificar el canal
                    // @ts-ignore — expo-notifications permite estas props nativas
                    channelId: ANDROID_CHANNEL_ID,
                    ongoing: true,
                }),
            },
            trigger: null, // Inmediata
        });
    } catch (error) {
        // Silenciar errores de notificación para no interrumpir la UX del timer
        console.warn('[notifications] No se pudo actualizar la notificación del timer.', error);
    }
}

/**
 * Cancela la notificación persistente del timer.
 * Llamar al pausar, cancelar o completar el desafío.
 */
export async function cancelChallengeTimerNotification(): Promise<void> {
    try {
        await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
        await Notifications.cancelScheduledNotificationAsync(TIMER_NOTIFICATION_ID);
    } catch (error) {
        console.warn('[notifications] No se pudo cancelar la notificación del timer.', error);
    }
}

/**
 * Muestra una notificación estática con la hora de finalización del desafío.
 * Usar cuando la app pasa a background: no necesita actualizarse y siempre es exacta.
 *
 * @param challengeTitle - Título del desafío.
 * @param endAtTimestamp - Timestamp (ms) en que termina el timer.
 */
export async function showChallengeEndTimeNotification(
    challengeTitle: string,
    endAtTimestamp: number
): Promise<void> {
    const endDate = new Date(endAtTimestamp);
    // toLocaleTimeString respeta el timezone local del dispositivo
    const timeStr = endDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    try {
        await Notifications.scheduleNotificationAsync({
            identifier: TIMER_NOTIFICATION_ID,
            content: {
                title: `⏱ ${challengeTitle}`,
                body: `Finaliza a las ${timeStr}`,
                sticky: true,
                autoDismiss: false,
                data: { type: 'challenge-timer' },
                ...(Platform.OS === 'android' && {
                    // @ts-ignore
                    channelId: ANDROID_CHANNEL_ID,
                    ongoing: true,
                }),
            },
            trigger: null,
        });
    } catch (error) {
        console.warn('[notifications] No se pudo mostrar la notificación de hora de fin.', error);
    }
}
