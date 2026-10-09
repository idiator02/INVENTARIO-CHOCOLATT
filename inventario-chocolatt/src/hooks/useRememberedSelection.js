import { useState } from 'react';
const prefix = `chocolatt:${import.meta.env.VITE_DEMO_MODE === 'true' ? 'demo:' : ''}selection:`;
export function useRememberedSelection(key, initial, allowed) {
  const storageKey = prefix + key;
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return typeof saved === typeof initial && (!allowed || allowed.includes(saved)) ? saved : initial;
    } catch { return initial; }
  });
  function remember(next) {
    setValue(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Selection still works without browser storage. */ }
  }
  return [value, remember];
}
