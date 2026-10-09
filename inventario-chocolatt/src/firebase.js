import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
if (!config.apiKey || !config.projectId || !config.appId) {
  throw new Error('Falta la configuración de Firebase. Completa el archivo .env siguiendo el README.');
}
export const db = initializeFirestore(initializeApp(config), {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
