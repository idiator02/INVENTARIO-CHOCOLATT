import { roundQty } from './inventory.js';

const combinedZones = ['B.Chocolatt', 'Almacén'];
const productKey = c => JSON.stringify([c.producto, c.categoria]);

// Do not silently report a partial physical count as a complete bar total.
export function incompleteChocolattCounts(counts) {
  const products = new Map();
  for (const count of counts.filter(c => combinedZones.includes(c.zona))) {
    const key = productKey(count);
    if (!products.has(key)) products.set(key, { producto: count.producto, zones: new Set() });
    products.get(key).zones.add(count.zona);
  }
  return [...products.values()].flatMap(p => combinedZones.filter(z => !p.zones.has(z)).map(zona => ({ producto: p.producto, zona })));
}

export function groupedConsumption(counts) {
  const groups = new Map();
  for (const count of counts) {
    const zona = combinedZones.includes(count.zona) ? 'B.Chocolatt' : count.zona;
    const key = JSON.stringify([zona, productKey(count)]);
    const group = groups.get(key) ?? { producto: count.producto, categoria: count.categoria, zona, inventarioInicial: 0, traslado: 0, teorico: 0, fisico: 0 };
    for (const [field, value] of Object.entries({ inventarioInicial: count.inventarioInicial ?? count.teorico, traslado: count.traslado ?? 0, teorico: count.teorico, fisico: count.fisico })) {
      group[field] = roundQty(group[field] + value);
    }
    groups.set(key, group);
  }
  // Offset a surplus in one location against a shortage in the other before clamping.
  return [...groups.values()].map(c => ({ ...c, consumo: Math.max(0, roundQty(c.teorico - c.fisico)) }))
    .sort((a, b) => ['B.Chocolatt', 'B.Medio', 'B.Chica'].indexOf(a.zona) - ['B.Chocolatt', 'B.Medio', 'B.Chica'].indexOf(b.zona) || a.producto.localeCompare(b.producto, 'es'));
}
