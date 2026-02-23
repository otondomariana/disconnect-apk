// lib/delete-account.ts
// Elimina todos los datos del usuario en Firestore y luego borra su cuenta de Firebase Auth.
// Requiere re-autenticación para poder llamar a deleteUser().

import type { User } from 'firebase/auth';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import {
    collection,
    doc,
    getDocs,
    query,
    where,
    writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Colecciones que tienen documentos con campo `userId == uid`
 * y deben ser eliminadas cuando el usuario borra su cuenta.
 */
const USER_COLLECTIONS = ['challengeSessions', 'userAchievements', 'reflections'] as const;

/**
 * Borra en lote todos los documentos de una colección que
 * pertenecen al usuario dado.
 */
async function deleteUserCollection(uid: string, collectionName: string): Promise<void> {
    const q = query(collection(db, collectionName), where('userId', '==', uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    // writeBatch acepta hasta 500 operaciones; dividimos si hay muchos docs
    const BATCH_SIZE = 400;
    let batch = writeBatch(db);
    let count = 0;

    for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;

        if (count === BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
    }
}

/**
 * Elimina la cuenta del usuario y todos sus datos en Firestore.
 *
 * @param password - Contraseña actual del usuario para re-autenticarse.
 * @throws Si la contraseña es incorrecta o la re-autenticación falla.
 */
export async function deleteAccountAndData(password: string): Promise<void> {
    const user: User | null = auth.currentUser;
    if (!user || !user.email) {
        throw new Error('No hay sesión activa.');
    }

    // 1. Re-autenticar (Firebase exige sesión reciente para deleteUser)
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    const uid = user.uid;

    // 2. Borrar datos en Firestore (colecciones con userId)
    await Promise.all(USER_COLLECTIONS.map((col) => deleteUserCollection(uid, col)));

    // 3. Borrar perfil del usuario (doc individual)
    const userDocRef = doc(db, 'users', uid);
    const batch = writeBatch(db);
    batch.delete(userDocRef);
    await batch.commit();

    // 4. Borrar la cuenta en Firebase Auth
    await deleteUser(user);
}
