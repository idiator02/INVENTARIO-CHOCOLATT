import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperations } from '../src/data/operations.js';
import { createMemoryStore } from '../src/data/memoryStore.js';
import { activeCounts, parseStockKey, productId, quantity, stockKey, countToken } from '../src/domain/inventory.js';
import { countRows, inventoryRows } from '../src/domain/exportRows.js';
const product = { id: 'legacy-id', nombre: 'Ron-Añejo', categoria: 'Alcohol' };
const inventoryPath = zone => `inventario/${stockKey(product.nombre, zone)}`;
function fixture(a = 12, b = 4, commit) {
  const store = createMemoryStore({ [`productos/${product.id}`]: { nombre: product.nombre, categoria: product.categoria }, [inventoryPath('B.Chocolatt')]: { cantidad: a }, [inventoryPath('B.Medio')]: { cantidad: b } }, commit);
  const api = createOperations(store);
  const record = zone => store.dump()[inventoryPath(zone)];
  const inventory = () => Object.fromEntries(Object.entries(store.dump()).filter(([key]) => key.startsWith('inventario/')).map(([key, value]) => [key.slice(11), value]));
  return { store, api, record, inventory };
}
test('Spanish decimals, zero and strict invalid input validation', () => {
  assert.equal(quantity(' 1,25 '), 1.25); assert.equal(quantity('.5'), .5); assert.equal(quantity('0'), 0);
  for (const input of ['', '-1', '1abc', 'Infinity', '1e2', '1,2,3', '1.234', '1000001', '0x10', NaN]) assert.throws(() => quantity(input));
  assert.throws(() => quantity(0, false));
});
test('a transfer conserves stock and never truncates an insufficient origin', async () => {
  const f = fixture();
  await f.api.transfer(product, 'B.Chocolatt', 'B.Medio', '2,5');
  assert.equal(f.record('B.Chocolatt').cantidad, 9.5); assert.equal(f.record('B.Medio').cantidad, 6.5);
  const before = f.store.dump();
  await assert.rejects(f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 10), /suficientes/);
  assert.deepEqual(f.store.dump(), before);
});
test('negative quantities and same-zone transfers do not mutate stock', async () => {
  const f = fixture(), before = f.store.dump();
  await assert.rejects(f.api.transfer(product, 'B.Chocolatt', 'B.Medio', -2));
  await assert.rejects(f.api.transfer(product, 'B.Chocolatt', 'B.Chocolatt', 2), /distintos/);
  assert.deepEqual(f.store.dump(), before);
});
test('concurrent transfers use fresh stock instead of losing one movement', async () => {
  const f = fixture(12, 0), anotherClient = createOperations(f.store);
  await Promise.all([f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 3), anotherClient.transfer(product, 'B.Chocolatt', 'B.Medio', 4)]);
  assert.equal(f.record('B.Chocolatt').cantidad, 5); assert.equal(f.record('B.Medio').cantidad, 7);
});
test('two clients cannot spend the same final units', async () => {
  const f = fixture(5, 0);
  const outcomes = await Promise.allSettled([f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 4), f.api.transfer(product, 'B.Chocolatt', 'B.Chica', 4)]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.record('B.Chocolatt').cantidad, 1);
  assert.equal((f.record('B.Medio')?.cantidad || 0) + (f.record('B.Chica')?.cantidad || 0), 4);
});
test('Auxiliar never persists a stock or a consumption entry', async () => {
  const f = fixture(0, 0);
  await f.api.transfer(product, 'Auxiliar', 'B.Chocolatt', '0,1');
  await f.api.transfer(product, 'Auxiliar', 'B.Chocolatt', '0,2');
  assert.equal(f.record('B.Chocolatt').cantidad, .3);
  await f.api.transfer(product, 'B.Chocolatt', 'Auxiliar', '.3');
  assert.equal(f.record('B.Chocolatt').cantidad, 0);
  assert.equal(f.record('Auxiliar'), undefined); assert.equal(activeCounts(f.inventory()).length, 0);
});
test('count zero, persist it and edit without losing original theoretical stock', async () => {
  const f = fixture(12, 8);
  await f.api.saveCount(product, 'B.Medio', '0', countToken(f.record('B.Medio')));
  const anotherClient = createOperations(f.store);
  assert.equal(activeCounts(f.inventory())[0].consumo, 8);
  await anotherClient.saveCount(product, 'B.Medio', '2,5', countToken(f.record('B.Medio')));
  assert.equal(f.record('B.Medio').cantidad, 2.5);
  assert.equal(f.record('B.Medio').recuento.teorico, 8);
  assert.equal(f.record('B.Medio').recuento.consumo, 5.5);
});
test('counts reject Auxiliar and unknown zones', async () => {
  const f = fixture();
  for (const zone of ['Auxiliar', 'Desconocida']) await assert.rejects(f.api.saveCount(product, zone, 0, countToken(f.record(zone))), /Selecciona/);
});
test('a surplus remains visible instead of becoming negative consumption', async () => {
  const f = fixture();
  await f.api.saveCount(product, 'B.Medio', 7, countToken(f.record('B.Medio')));
  const count = activeCounts(f.inventory())[0];
  assert.equal(count.consumo, 0); assert.equal(count.diferencia, -3); assert.equal(f.record('B.Medio').cantidad, 7);
});
test('stale counts cannot overwrite later movements', async () => {
  const f = fixture(), expected = countToken(f.record('B.Medio'));
  await f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 2);
  await assert.rejects(f.api.saveCount(product, 'B.Medio', 1, expected), /han cambiado/);
  assert.equal(f.record('B.Medio').cantidad, 6);
});
test('simultaneous physical counts cannot silently overwrite each other', async () => {
  const f = fixture(), expected = countToken(f.record('B.Medio'));
  const results = await Promise.allSettled([f.api.saveCount(product, 'B.Medio', 1, expected), f.api.saveCount(product, 'B.Medio', 2, expected)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('correction and undo preserve later incoming and outgoing transfers', async () => {
  const f = fixture();
  await f.api.saveCount(product, 'B.Medio', 2, countToken(f.record('B.Medio')));
  const token = countToken(f.record('B.Medio'));
  await f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 3);
  await f.api.transfer(product, 'B.Medio', 'B.Chica', 1.5);
  await f.api.saveCount(product, 'B.Medio', 3, token);
  assert.equal(f.record('B.Medio').cantidad, 4.5);
  assert.equal(f.record('B.Medio').recuento.consumo, 1);
  assert.equal(f.record('B.Chica').cantidad, 1.5);
  assert.equal(f.record('B.Chocolatt').cantidad, 9);
  await f.api.undoCount(activeCounts(f.inventory())[0]);
  assert.equal(f.record('B.Medio').cantidad, 5.5);
  assert.equal(activeCounts(f.inventory()).length, 0);
  assert.equal(f.record('B.Chica').cantidad, 1.5);
});
test('closing counts preserves current stock, including later movements', async () => {
  const f = fixture();
  await f.api.saveCount(product, 'B.Medio', 2, countToken(f.record('B.Medio')));
  const counts = activeCounts(f.inventory());
  await f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 1);
  await f.api.clearCounts(counts);
  assert.equal(f.record('B.Medio').cantidad, 3); assert.equal(activeCounts(f.inventory()).length, 0);
});
test('closing a stale list must not remove a newer count', async () => {
  const f = fixture();
  await f.api.saveCount(product, 'B.Medio', 2, countToken(f.record('B.Medio')));
  const counts = activeCounts(f.inventory());
  await f.api.saveCount(product, 'B.Medio', 1, countToken(f.record('B.Medio')));
  await assert.rejects(f.api.clearCounts(counts), /ha cambiado/);
  assert.equal(activeCounts(f.inventory())[0].fisico, 1);
});
test('catalog refuses duplicate names, unsafe paths and simultaneous additions', async () => {
  const f = fixture();
  await assert.rejects(f.api.addProduct(' RON-AÑEJO ', 'Alcohol'), /Ya existe/);
  await assert.rejects(f.api.addProduct('Ron/Cola', 'Alcohol'), /sin barras/);
  const results = await Promise.allSettled([f.api.addProduct('Nuevo', 'Alcohol'), f.api.addProduct(' nuevo ', 'Refrescos')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(f.store.dump()[`productos/${productId('nuevo')}`]);
});
test('product deletion checks stock and cannot race a stock movement', async () => {
  const f = fixture();
  await assert.rejects(f.api.deleteProduct(product), /existencias/);
  const empty = fixture(0, 0);
  const results = await Promise.allSettled([empty.api.deleteProduct(product), empty.api.transfer(product, 'Auxiliar', 'B.Medio', 2)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  if (empty.record('B.Medio').cantidad > 0) assert.ok(empty.store.dump()[`productos/${product.id}`]);
});
test('reset is atomic and rejects changes made after its confirmation was opened', async () => {
  const f = fixture(), prior = f.inventory();
  await f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 2);
  const before = f.store.dump();
  await assert.rejects(f.api.resetInventory(prior), /han cambiado/);
  assert.deepEqual(f.store.dump(), before);
  await f.api.resetInventory(f.inventory());
  assert.equal(f.record('B.Chocolatt').cantidad, 0); assert.equal(f.record('B.Medio').cantidad, 0);
});
test('a failed commit leaves stock unchanged and reports failure', async () => {
  const f = fixture(12, 4, () => { throw new Error('permission-denied'); });
  const before = f.store.dump();
  await assert.rejects(f.api.transfer(product, 'B.Chocolatt', 'B.Medio', 2), /permission/);
  assert.deepEqual(f.store.dump(), before);
});
test('hyphens in names, accented zones and numeric export cells are preserved', async () => {
  const f = fixture();
  assert.deepEqual(parseStockKey('Ron-Añejo-B.Medio'), { producto: 'Ron-Añejo', zona: 'B.Medio' });
  await f.api.saveCount(product, 'B.Medio', 1.5, countToken(f.record('B.Medio')));
  const counts = countRows(activeCounts(f.inventory()));
  assert.deepEqual(counts[0], ['Barra', 'Producto', 'Inventario inicial', 'Traslado', 'Consumo', 'Inventario final']);
  assert.equal(counts[1][1], 'Ron-Añejo'); assert.equal(counts[1][4], 2.5);
  assert.equal(activeCounts(f.inventory())[0].consumo, 2.5);
  const rows = inventoryRows([product], f.inventory());
  assert.equal(rows[1][1], 12); assert.equal(rows[1][2], 1.5); assert.equal(rows[1][5], 13.5);
  assert.ok(!rows[0].includes('Categoría'));
  assert.ok(!rows[0].includes('Auxiliar'));
});

test('zero consumption is excluded only from export and exporting is read-only', async () => {
  const f = fixture(12, 4);
  await f.api.saveCount(product, 'B.Medio', 4, countToken(f.record('B.Medio')));
  const before = f.store.dump();
  assert.equal(activeCounts(f.inventory()).length, 1);
  assert.deepEqual(countRows(activeCounts(f.inventory())), [['Barra', 'Producto', 'Inventario inicial', 'Traslado', 'Consumo', 'Inventario final']]);
  inventoryRows([product], f.inventory());
  assert.deepEqual(f.store.dump(), before);
  await f.api.saveCount(product, 'B.Medio', 2.75, countToken(f.record('B.Medio')));
  assert.equal(countRows(activeCounts(f.inventory()))[1][4], 1.25);
});
test('downward correction after movements keeps decimals and rejects negative stock atomically', async () => {
  const f = fixture();
  await f.api.saveCount(product, 'B.Medio', 3, countToken(f.record('B.Medio')));
  await f.api.transfer(product, 'B.Medio', 'Auxiliar', 1.5);
  await f.api.saveCount(product, 'B.Medio', 2, countToken(f.record('B.Medio')));
  assert.equal(f.record('B.Medio').cantidad, .5);
  assert.equal(f.record('B.Medio').recuento.consumo, 2);
  const before = f.store.dump();
  await assert.rejects(f.api.saveCount(product, 'B.Medio', 0, countToken(f.record('B.Medio'))), /negativas/);
  assert.deepEqual(f.store.dump(), before);
  assert.equal(f.record('Auxiliar'), undefined);
});
test('concurrent correction and transfer use fresh stock without losing either change', async () => {
  const f = fixture();
  await f.api.saveCount(product, 'B.Medio', 2, countToken(f.record('B.Medio')));
  await Promise.all([
    f.api.saveCount(product, 'B.Medio', 3, countToken(f.record('B.Medio'))),
    f.api.transfer(product, 'Auxiliar', 'B.Medio', 1.25),
  ]);
  assert.equal(f.record('B.Medio').cantidad, 4.25);
  assert.equal(f.record('B.Medio').recuento.consumo, 1);
});
test('undo uses the latest movements but never overwrites a newer count', async () => {
  const f = fixture();
  await f.api.saveCount(product, 'B.Medio', 2, countToken(f.record('B.Medio')));
  const saved = activeCounts(f.inventory())[0];
  await f.api.saveCount(product, 'B.Medio', 3, countToken(f.record('B.Medio')));
  await assert.rejects(f.api.undoCount(saved), /ha cambiado/);
  const current = activeCounts(f.inventory())[0];
  await Promise.all([f.api.undoCount(current), f.api.transfer(product, 'Auxiliar', 'B.Medio', 2)]);
  assert.equal(f.record('B.Medio').cantidad, 6);
  assert.equal(activeCounts(f.inventory()).length, 0);
});

test('screen-specific incoming movements and inter-bar outgoing stock produce the requested Excel breakdown', async () => {
  const f = fixture(0, 0);
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 10, 'traspasos');
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 4, 'consumo');
  assert.equal(f.record('B.Medio').cantidad, 14);
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 10, traslado: 4 });
  await f.api.transfer(product, 'B.Medio', 'B.Chica', 3, 'consumo');
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 7, traslado: 4 });
  assert.deepEqual(f.record('B.Chica').balanceConsumo, { inventarioInicial: 0, traslado: 3 });
  assert.equal(f.record('B.Medio').cantidad, 11);
  assert.equal(f.record('B.Chica').cantidad, 3);
  await f.api.saveCount(product, 'B.Medio', 2, countToken(f.record('B.Medio')));
  await f.api.saveCount(product, 'B.Chica', 1, countToken(f.record('B.Chica')));
  const before = f.store.dump();
  const rows = countRows(activeCounts(f.inventory()));
  assert.deepEqual(rows.find(row => row[0] === 'Barra Medio'), ['Barra Medio', 'Ron-Añejo', 7, 4, 9, 2]);
  assert.deepEqual(rows.find(row => row[0] === 'Barra Chica'), ['Barra Chica', 'Ron-Añejo', 0, 3, 2, 1]);
  assert.deepEqual(f.store.dump(), before);
  assert.equal(f.record('Auxiliar'), undefined);
});

test('outgoing stock also reduces initial balance when it comes from night replenishments', async () => {
  const f = fixture(0, 0);
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 5.75, 'consumo');
  await f.api.transfer(product, 'B.Medio', 'B.Chica', 2.25, 'consumo');
  await f.api.saveCount(product, 'B.Medio', 1.5, countToken(f.record('B.Medio')));
  const row = countRows(activeCounts(f.inventory()))[1];
  assert.deepEqual(row, ['Barra Medio', 'Ron-Añejo', -2.25, 5.75, 2, 1.5]);
  assert.equal(row[2] + row[3] - row[5], row[4]);
  assert.equal(f.record('B.Chica').cantidad, 2.25);
});

test('both directions are accounted for in Traspasos and returns never create consumption', async () => {
  const f = fixture(0, 0);
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 8.5, 'traspasos');
  await f.api.transfer(product, 'B.Medio', 'B.Chica', 2, 'traspasos');
  await f.api.transfer(product, 'B.Medio', 'Almacén', 1.25, 'traspasos');
  await f.api.transfer(product, 'B.Medio', 'Auxiliar', .25, 'traspasos');
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 5, traslado: 0 });
  assert.deepEqual(f.record('B.Chica').balanceConsumo, { inventarioInicial: 2, traslado: 0 });
  await f.api.saveCount(product, 'B.Medio', 5, countToken(f.record('B.Medio')));
  assert.equal(f.record('B.Medio').recuento.consumo, 0);
  assert.equal(countRows(activeCounts(f.inventory())).length, 1);
});

test('count correction retains its original breakdown and undo preserves all later replenishments', async () => {
  const f = fixture(0, 0);
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 10, 'traspasos');
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 2.5, 'consumo');
  await f.api.saveCount(product, 'B.Medio', 4, countToken(f.record('B.Medio')));
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 1.5, 'consumo');
  await f.api.saveCount(product, 'B.Medio', 5, countToken(f.record('B.Medio')));
  assert.deepEqual(countRows(activeCounts(f.inventory()))[1], ['Barra Medio', 'Ron-Añejo', 10, 2.5, 7.5, 5]);
  assert.equal(f.record('B.Medio').cantidad, 6.5);
  await f.api.undoCount(activeCounts(f.inventory())[0]);
  assert.equal(f.record('B.Medio').cantidad, 14);
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 10, traslado: 4 });
  await f.api.saveCount(product, 'B.Medio', 3, countToken(f.record('B.Medio')));
  assert.deepEqual(countRows(activeCounts(f.inventory()))[1], ['Barra Medio', 'Ron-Añejo', 10, 4, 11, 3]);
});

test('closing a period carries actual stock forward and reset clears the breakdown', async () => {
  const f = fixture(0, 0);
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 10, 'traspasos');
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 4, 'consumo');
  await f.api.saveCount(product, 'B.Medio', 3, countToken(f.record('B.Medio')));
  await f.api.clearCounts(activeCounts(f.inventory()));
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 3, traslado: 0 });
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 2, 'consumo');
  await f.api.saveCount(product, 'B.Medio', 1, countToken(f.record('B.Medio')));
  assert.deepEqual(countRows(activeCounts(f.inventory()))[1], ['Barra Medio', 'Ron-Añejo', 3, 2, 4, 1]);
  await f.api.resetInventory(f.inventory());
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 0, traslado: 0 });
  assert.equal(f.record('B.Medio').cantidad, 0);
});

test('breakdown survives storage reload and concurrent operations of different screens', async () => {
  const f = fixture(0, 0);
  await Promise.all([
    f.api.transfer(product, 'Auxiliar', 'B.Medio', 1.25, 'traspasos'),
    f.api.transfer(product, 'Auxiliar', 'B.Medio', 2.5, 'consumo'),
  ]);
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 1.25, traslado: 2.5 });
  const reopened = createMemoryStore(f.store.dump()), api = createOperations(reopened);
  await api.saveCount(product, 'B.Medio', .5, countToken(reopened.dump()[inventoryPath('B.Medio')]));
  const count = reopened.dump()[inventoryPath('B.Medio')].recuento;
  assert.equal(count.inventarioInicial, 1.25);
  assert.equal(count.traslado, 2.5);
  assert.equal(count.consumo, 3.25);
});

test('legacy records and counts preserve their theoretical values as opening balance', async () => {
  const f = fixture(12, 8);
  await f.api.transfer(product, 'Auxiliar', 'B.Medio', 2.25, 'consumo');
  assert.deepEqual(f.record('B.Medio').balanceConsumo, { inventarioInicial: 8, traslado: 2.25 });
  const legacyCount = { id: 'old-count', producto: product.nombre, categoria: product.categoria, zona: 'B.Medio', teorico: 8, fisico: 2, consumo: 6, diferencia: 6 };
  assert.deepEqual(countRows([legacyCount])[1], ['Barra Medio', 'Ron-Añejo', 8, 0, 6, 2]);
  const data = f.store.dump();
  data[inventoryPath('B.Medio')] = { cantidad: 3, recuento: legacyCount };
  const store = createMemoryStore(data), api = createOperations(store);
  await api.transfer(product, 'Auxiliar', 'B.Medio', 1.5, 'consumo');
  assert.deepEqual(store.dump()[inventoryPath('B.Medio')].balanceConsumo, { inventarioInicial: 9, traslado: 1.5 });
  await api.undoCount({ ...legacyCount, key: stockKey(product.nombre, 'B.Medio') });
  assert.equal(store.dump()[inventoryPath('B.Medio')].cantidad, 10.5);
});

test('invalid movement source and inconsistent balances never write partial changes', async () => {
  const f = fixture();
  let before = f.store.dump();
  await assert.rejects(f.api.transfer(product, 'Auxiliar', 'B.Medio', 1, 'other'), /origen del movimiento/);
  await assert.rejects(f.api.transfer(product, 'Auxiliar', 'Almacén', 1, 'consumo'), /destino/);
  assert.deepEqual(f.store.dump(), before);
  const data = f.store.dump();
  data[inventoryPath('B.Medio')].balanceConsumo = { inventarioInicial: 10, traslado: 1 };
  const store = createMemoryStore(data), api = createOperations(store);
  before = store.dump();
  await assert.rejects(api.transfer(product, 'B.Chocolatt', 'B.Medio', 1, 'consumo'), /no coincide/);
  assert.deepEqual(store.dump(), before);
});
