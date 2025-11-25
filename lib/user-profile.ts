import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firebase';

export type UserProfileInput = {
  displayName: string;
  email: string;
  birthDate: string;
  country: string;
};

const normalizeProfile = (profile: UserProfileInput) => ({
  displayName: profile.displayName.trim(),
  email: profile.email.trim(),
  birthDate: profile.birthDate.trim(),
  country: profile.country.trim(),
});

export async function saveUserProfile(user: User, profile: UserProfileInput) {
  const normalized = normalizeProfile(profile);
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);

  const payload: Record<string, any> = {
    ...normalized,
    lastLoginAt: serverTimestamp(),
  };

  if (!snapshot.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });
}

type EnsureOptions = {
  requireCompleteProfile?: boolean;
};

const isCompleteProfile = (profile: ReturnType<typeof normalizeProfile>) =>
  profile.displayName.length > 0 &&
  profile.email.length > 0 &&
  profile.birthDate.length > 0 &&
  profile.country.length > 0;

export async function ensureUserProfile(
  user: User,
  profile?: UserProfileInput,
  options?: EnsureOptions
) {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    if (!profile) {
      throw new Error('Missing profile data for new account.');
    }

    const normalized = normalizeProfile(profile);
    if (options?.requireCompleteProfile && !isCompleteProfile(normalized)) {
      throw new Error('Incomplete profile data for new account.');
    }

    await setDoc(
      ref,
      {
        ...normalized,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  }

  await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true });
  return false;
}

export async function touchLastLogin(user: User | null) {
  if (!user) return;
  await setDoc(doc(db, 'users', user.uid), { lastLoginAt: serverTimestamp() }, { merge: true });
}
