// Isolated transaction store: never imports or connects to Firebase.
export function createMemoryStore(initial = {}, onCommit = () => {}) {
  let data = structuredClone(initial);
  const versions = new Map();
  let id = 0;
  return {
    id: () => `local-${Date.now()}-${++id}`,
    timestamp: () => new Date().toISOString(),
    dump: () => structuredClone(data),
    products: async () => Object.entries(data).filter(([key]) => key.startsWith('productos/')).map(([key, value]) => ({ ...value, id: key.slice(10) })),
    async transact(callback) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const reads = new Map(), writes = new Map();
        const result = await callback({
          get: async key => {
            if (writes.size) throw new Error('Transaction read after write');
            reads.set(key, versions.get(key) || 0);
            return structuredClone(data[key] ?? null);
          },
          set: (key, value) => writes.set(key, structuredClone(value)),
          delete: key => writes.set(key, null),
        });
        if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
        const next = { ...data };
        for (const [key, value] of writes) {
          if (value === null) delete next[key]; else next[key] = value;
        }
        onCommit(structuredClone(next));
        for (const key of writes.keys()) versions.set(key, (versions.get(key) || 0) + 1);
        data = next;
        return result;
      }
      throw new Error('Demasiados cambios simultáneos. Inténtalo de nuevo.');
    },
  };
}
