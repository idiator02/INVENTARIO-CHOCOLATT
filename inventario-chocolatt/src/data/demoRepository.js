import { DEFAULT_PRODUCTS, REAL_ZONES, productId, stockKey } from '../domain/inventory.js';
import { createMemoryStore } from './memoryStore.js';
import { createOperations } from './operations.js';
const storageKey = 'chocolatt-demo-v1';
function seed() {
  const data = {};
  Object.entries(DEFAULT_PRODUCTS).forEach(([categoria, names]) => names.forEach((nombre, i) => {
    data[`productos/${productId(nombre)}`] = { nombre, categoria };
    REAL_ZONES.forEach((zone, z) => {
      data[`inventario/${stockKey(nombre, zone)}`] = { cantidad: i % 8 === 7 ? 0 : [12, 8, 6, 36][z] + i % 4 };
    });
  }));
  return data;
}
let initial;
try { initial = JSON.parse(localStorage.getItem(storageKey)) || seed(); } catch { initial = seed(); }
const listeners = new Set();
const store = createMemoryStore(initial, next => {
  localStorage.setItem(storageKey, JSON.stringify(next));
  queueMicrotask(() => listeners.forEach(listener => listener(snapshot())));
});
function snapshot() {
  const data = store.dump();
  return {
    products: Object.entries(data).filter(([key]) => key.startsWith('productos/')).map(([key, value]) => ({ ...value, id: key.slice(10) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    inventory: Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith('inventario/')).map(([key, value]) => [key.slice(11), value])),
    transfers: Object.entries(data).filter(([key]) => key.startsWith('trasladosConsumo/')).map(([key, value]) => ({ ...value, id: key.slice('trasladosConsumo/'.length) })).sort((a, b) => b.orden - a.orden || a.id.localeCompare(b.id)),
    transfersSynced: true, transfersError: null,
    loaded: true, synced: true, error: null,
  };
}
export const repository = {
  ...createOperations(store),
  subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
};
