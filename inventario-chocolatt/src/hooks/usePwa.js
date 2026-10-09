import { useEffect, useState } from 'react';
export function usePwa() {
  const [prompt, setPrompt] = useState(null);
  const [waiting, setWaiting] = useState(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
  useEffect(() => {
    const before = event => { event.preventDefault(); setPrompt(event); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', done); };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let disposed = false;
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`).then(registration => {
      if (disposed) return;
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (!disposed && worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        });
      });
    }).catch(error => console.warn('No se pudo activar el modo sin conexión.', error.code || error.name));
    return () => { disposed = true; };
  }, []);
  return {
    installed, canPrompt: Boolean(prompt), hasUpdate: Boolean(waiting),
    async install() { if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); } },
    update() {
      if (!waiting) return;
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      waiting.postMessage({ type: 'SKIP_WAITING' });
    },
  };
}
