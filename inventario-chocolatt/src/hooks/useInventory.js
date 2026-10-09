import { useEffect, useState } from 'react';
export const DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
export function useInventory() {
  const [state, setState] = useState({ products: [], inventory: {}, transfers: [], transfersSynced: false, transfersError: null, loaded: false, synced: false, error: null });
  const [repository, setRepository] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    let cancelled = false, stop;
    const module = DEMO ? import('../data/demoRepository.js') : import('../data/firebaseRepository.js');
    module.then(({ repository: repo }) => {
      if (cancelled) return;
      setRepository(repo);
      stop = repo.subscribe(setState);
    }).catch(error => { if (!cancelled) setState(prev => ({ ...prev, error })); });
    return () => { cancelled = true; stop?.(); };
  }, []);
  return { ...state, repository, online, canWrite: online && state.synced && !state.error && Boolean(repository) };
}
