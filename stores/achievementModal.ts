import { create } from 'zustand';

interface AchievementModalState {
    isVisible: boolean;
    title: string;
    description: string;
    showAchievement: (title: string, description: string) => void;
    hideAchievement: () => void;
}

export const useAchievementModalStore = create<AchievementModalState>((set) => ({
    isVisible: false,
    title: '',
    description: '',
    showAchievement: (title, description) => set({ isVisible: true, title, description }),
    hideAchievement: () => set({ isVisible: false, title: '', description: '' }),
}));
