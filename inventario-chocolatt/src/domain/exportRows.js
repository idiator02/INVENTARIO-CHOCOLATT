import { excelQuantity } from './softDrinks.js';
import { groupedConsumption, incompleteChocolattCounts } from './countGroups.js';
import { CATEGORIES, REAL_ZONES, ZONE_LABELS, getStock, roundQty } from './inventory.js';
export function inventoryRows(products, inventory) {
  return [['Producto', ...REAL_ZONES.map(z => ZONE_LABELS[z]), 'Total'],
    ...CATEGORIES.flatMap(category => products.filter(p => p.categoria === category).map(p => {
      const values = REAL_ZONES.map(z => getStock(inventory, p.nombre, z));
      return [p.nombre, ...values.map(value => excelQuantity(p, value)), excelQuantity(p, roundQty(values.reduce((a, b) => a + b, 0)))];
    }))];
}
export function countRows(counts) {
  const missing = incompleteChocolattCounts(counts);
  if (missing.length) throw new Error(`Completa el recuento de ${missing.map(c => `${c.producto} en ${ZONE_LABELS[c.zona]}`).join('; ')} (también si queda cero) para calcular el total de Barra Chocolatt.`);
  return [['Barra', 'Producto', 'Inventario inicial', 'Traslado', 'Consumo', 'Inventario final'], ...groupedConsumption(counts).filter(c => c.consumo > 0).map(c => [
    ZONE_LABELS[c.zona], c.producto, ...[c.inventarioInicial ?? c.teorico, c.traslado ?? 0, c.consumo, c.fisico].map(value => excelQuantity(c, value)),
  ])];
}
