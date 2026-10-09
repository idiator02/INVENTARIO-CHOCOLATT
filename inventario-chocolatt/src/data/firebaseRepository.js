import { collection, doc, getDocsFromServer, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { createOperations } from './operations.js';
const productsFrom = snapshot => snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
  .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
const store = {
  id: () => crypto.randomUUID(),
  timestamp: serverTimestamp,
  products: async () => productsFrom(await getDocsFromServer(collection(db, 'productos'))),
  transact: callback => runTransaction(db, tx => callback({
    get: async path => (await tx.get(doc(db, path))).data() ?? null,
    set: (path, data) => tx.set(doc(db, path), data),
    delete: path => tx.delete(doc(db, path)),
  })),
};
export const repository = {
  ...createOperations(store),
  subscribe(onChange) {
    const state = { products: [], inventory: {}, transfers: [] };
    const loaded = {}, synced = {}, errors = {};
    const emit = () => onChange({ ...state, loaded: Boolean(loaded.products && loaded.inventory),
      synced: Boolean(synced.products && synced.inventory), error: errors.products || errors.inventory || null, transfersSynced: Boolean(synced.transfers), transfersError: errors.transfers || null });
    const listen = (name, key, convert) => onSnapshot(collection(db, name), { includeMetadataChanges: true }, snapshot => {
      state[key] = convert(snapshot);
      loaded[key] = true;
      synced[key] = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
      errors[key] = null;
      emit();
    }, error => { errors[key] = error; synced[key] = false; emit(); });
    const stopProducts = listen('productos', 'products', productsFrom);
    const stopInventory = listen('inventario', 'inventory', snapshot => Object.fromEntries(snapshot.docs.map(d => [d.id, d.data()])));
    const stopTransfers = listen('trasladosConsumo', 'transfers', snapshot => snapshot.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => b.orden - a.orden || a.id.localeCompare(b.id)));
    return () => { stopProducts(); stopInventory(); stopTransfers(); };
  },
};
