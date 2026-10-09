import { useEffect, useState } from 'react';
const KEY = `chocolatt:${import.meta.env.VITE_DEMO_MODE === 'true' ? 'demo:' : ''}product-favorites:v1`;
function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}
export function useProductFavorites() {
  const [favorites, setFavorites] = useState(readFavorites);
  const [favoriteError, setFavoriteError] = useState('');
  useEffect(() => {
    const sync = event => { if (event.key === KEY || event.key === null) setFavorites(readFavorites()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function toggleFavorite(id) {
    const current = readFavorites();
    const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setFavorites(next);
      setFavoriteError('');
    } catch { setFavoriteError('No se ha podido guardar el favorito en este dispositivo.'); }
  }
  return { favorites, onToggleFavorite: toggleFavorite, favoriteError };
}
