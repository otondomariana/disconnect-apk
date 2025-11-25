// stores/auth.ts
// Estado global mínimo para el usuario (Zustand)
import type { User } from "firebase/auth";
import { create } from "zustand";

type AuthState = {
  user: User | null;
  initialized: boolean;
  setUser: (u: User | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  setUser: (u) =>
    set((state) => {
      if (state.user === u && state.initialized) {
        return state;
      }
      return { user: u, initialized: true };
    })
}));
