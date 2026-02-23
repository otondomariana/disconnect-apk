// stores/challenge.ts
// Estado global para el desafío activo (Zustand)
import { create } from 'zustand';

export type ActiveChallengeStatus = 'running' | 'paused';

type ChallengeState = {
    // Identificación
    activeChallengeId: string | null;
    activeChallengeTitle: string | null;

    // Estado del timer
    activeChallengeStatus: ActiveChallengeStatus | null;
    activeEndAtMs: number | null;          // timestamp (ms) en que el timer expira (solo si running)
    activeStartedAtMs: number | null;      // timestamp (ms) en que se inició el desafío
    activePausedRemaining: number | null;  // segundos restantes al momento de pausar

    // Acciones
    setActiveChallenge: (id: string | null, title?: string | null) => void;
    setTimerRunning: (endAtMs: number, startedAtMs: number) => void;
    setTimerPaused: (pausedRemainingSeconds: number) => void;
    setTimerResumed: (newEndAtMs: number) => void;
};

export const useChallengeStore = create<ChallengeState>((set) => ({
    activeChallengeId: null,
    activeChallengeTitle: null,
    activeChallengeStatus: null,
    activeEndAtMs: null,
    activeStartedAtMs: null,
    activePausedRemaining: null,

    setActiveChallenge: (id, title = null) =>
        set(
            id
                ? { activeChallengeId: id, activeChallengeTitle: title }
                : {
                    activeChallengeId: null,
                    activeChallengeTitle: null,
                    activeChallengeStatus: null,
                    activeEndAtMs: null,
                    activeStartedAtMs: null,
                    activePausedRemaining: null,
                }
        ),

    setTimerRunning: (endAtMs, startedAtMs) =>
        set({
            activeChallengeStatus: 'running',
            activeEndAtMs: endAtMs,
            activeStartedAtMs: startedAtMs,
            activePausedRemaining: null,
        }),

    setTimerPaused: (pausedRemainingSeconds) =>
        set({
            activeChallengeStatus: 'paused',
            activeEndAtMs: null,
            activePausedRemaining: pausedRemainingSeconds,
        }),

    setTimerResumed: (newEndAtMs) =>
        set({
            activeChallengeStatus: 'running',
            activeEndAtMs: newEndAtMs,
            activePausedRemaining: null,
        }),
}));
