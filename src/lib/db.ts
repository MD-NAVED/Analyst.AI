import { openDB } from 'idb';

const DB_NAME = 'DataLensDB';
const STORE_NAME = 'session';
const STATE_KEY = 'appState';
const ENCRYPTION_KEY = 'D4t4L3n5S3cr3t!';

// Simple XOR encryption for JSON strings
const xorEncryptDecrypt = (input: string): string => {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    output += String.fromCharCode(input.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return output;
};

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const saveSession = async (state: any) => {
  try {
    const db = await initDB();
    const jsonString = JSON.stringify(state);
    const encrypted = xorEncryptDecrypt(jsonString);
    await db.put(STORE_NAME, encrypted, STATE_KEY);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Storage space exceeded');
    }
    throw error;
  }
};

export const loadSession = async () => {
  const db = await initDB();
  const encrypted = await db.get(STORE_NAME, STATE_KEY);
  if (!encrypted) return null;
  try {
    const decrypted = xorEncryptDecrypt(encrypted);
    return JSON.parse(decrypted);
  } catch (e) {
    console.error("Failed to decrypt or parse session", e);
    return null;
  }
};

export const clearSession = async () => {
  const db = await initDB();
  await db.delete(STORE_NAME, STATE_KEY);
};

export const getStorageEstimate = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return null;
};
