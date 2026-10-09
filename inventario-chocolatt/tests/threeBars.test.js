import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOperations } from '../src/data/operations.js';
import { createMemoryStore } from '../src/data/memoryStore.js';
import { activeCounts, countToken, COUNT_ZONES } from '../src/domain/inventory.js';
import { countRows } from '../src/domain/exportRows.js';
const signature = `data:image/png;base64,${readFileSync(new URL('./fixtures/signature.png', import.meta.url)).toString('base64')}`;
function fixture(category = 'Alcohol', extra = {}) {
  const product = { id: 'test', nombre: 'Producto', categoria: category };
  const store = createMemoryStore({ 'productos/test': product, ...extra });
  const api = createOperations(store);
  const record = zone => store.dump()[`inventario/Producto-${zone}`];
  const inventory = () => Object.fromEntries(Object.entries(store.dump()).filter(([k]) => k.startsWith('inventario/')).map(([k,v]) => [k.slice(11),v]));
  const counts = () => activeCounts(inventory());
  const rows = () => countRows(counts());
  const count = (zone, physical) => api.saveCount(product, zone, physical, countToken(record(zone)));
  const move = (a,b,n,source) => api.transfer(product,a,b,n,source);
  return { product, store, api, record, inventory, counts, rows, count, move };
}

test('three Excel bars combine Chocolatt + warehouse and exclude internal and outgoing movements', async () => {
  const f = fixture();
  await f.move('Auxiliar','Almacén',20);
  await f.move('Auxiliar','B.Chocolatt',10);
  await f.move('Almacén','B.Chocolatt',5);
  await f.move('Almacén','B.Medio',3,'consumo');
  await f.move('B.Chocolatt','B.Chica',2,'consumo');
  await f.count('B.Chocolatt',10); await f.count('Almacén',11);
  await f.count('B.Medio',1.5); await f.count('B.Chica',1);
  const before = f.store.dump();
  assert.deepEqual(f.rows().slice(1), [
    ['Barra Chocolatt','Producto',25,0,4,21],
    ['Barra Medio','Producto',0,3,1.5,1.5],
    ['Barra Chica','Producto',0,2,1,1],
  ]);
  assert.deepEqual(f.store.dump(),before);
  assert.equal(f.record('B.Chocolatt').cantidad,10); assert.equal(f.record('Almacén').cantidad,11);
  assert.equal(f.record('Auxiliar'),undefined);
});

test('combined surplus offsets shortage before clamping, zero total stays out of Excel', async () => {
  const f=fixture();await f.move('Auxiliar','B.Chocolatt',10);await f.move('Auxiliar','Almacén',10);
  await f.count('B.Chocolatt',6);await f.count('Almacén',12);
  assert.equal(f.rows()[1][4],2);
  await f.count('Almacén',14);assert.equal(f.rows().length,1);
});

test('soft drinks sum exact units in both locations before Excel box rounding', async () => {
  const f=fixture('Refrescos');await f.move('Auxiliar','B.Chocolatt',8);await f.move('Auxiliar','Almacén',8);
  await f.count('B.Chocolatt',0);await f.count('Almacén',0);
  assert.deepEqual(f.rows()[1],['Barra Chocolatt','Producto',0.5,0,0.5,0]);
});

test('partial Chocolatt counts request counterpart instead of silently inventing its final stock', async () => {
  const f=fixture();await f.move('Auxiliar','B.Chocolatt',5);await f.count('B.Chocolatt',2);
  assert.throws(f.rows,/Almacén/);
  await f.count('Almacén',0);assert.equal(f.rows()[1][4],3);
  await f.api.undoCount(f.counts().find(c=>c.zona==='Almacén'));assert.throws(f.rows,/Almacén/);
});

test('new locations correct and undo counts after movements and persist across reload', async () => {
  const f=fixture();await f.move('Auxiliar','B.Chocolatt',10);await f.move('Auxiliar','Almacén',10);
  await f.count('B.Chocolatt',6);await f.count('Almacén',7);
  await f.move('Almacén','B.Chocolatt',2);await f.count('Almacén',8);
  assert.equal(f.record('Almacén').cantidad,6);assert.equal(f.record('B.Chocolatt').cantidad,8);
  assert.equal(f.rows()[1][4],6);
  const reloaded=createMemoryStore(f.store.dump()),api=createOperations(reloaded);
  await api.undoCount(f.counts().find(c=>c.zona==='Almacén'));
  assert.equal(reloaded.dump()['inventario/Producto-Almacén'].cantidad,8);
  const before=f.inventory();await f.api.clearCounts(f.counts());
  for(const z of ['B.Chocolatt','Almacén']) assert.equal(f.record(z).cantidad,before[`Producto-${z}`].cantidad);
  assert.equal(f.counts().length,0);
});

test('signed warehouse delivery can be edited and deleted after both source and destination counts', async () => {
  const f=fixture();await f.move('Auxiliar','Almacén',20);
  const draft={product:f.product,origin:'Almacén',destination:'B.Medio',amount:3};
  const list=()=>Object.entries(f.store.dump()).filter(([k])=>k.startsWith('trasladosConsumo/')).map(([k,v])=>({...v,id:k.slice('trasladosConsumo/'.length)}));
  await f.api.saveSignedTransfer(draft,signature);
  await f.count('Almacén',15);await f.count('B.Chocolatt',0);await f.count('B.Medio',1);
  assert.equal(f.rows()[1][4],2);
  await f.api.saveSignedTransfer({...draft,amount:4},signature,list()[0]);
  assert.equal(f.rows()[1][4],1);assert.equal(f.record('Almacén').cantidad,15);
  await f.api.deleteSignedTransfer(list()[0]);
  assert.equal(f.rows()[1][4],5);assert.equal(f.record('Almacén').cantidad,15);
});

test('legacy stale warehouse counters are rebased once without changing real stock', async () => {
  const f=fixture('Alcohol',{'inventario/Producto-Almacén':{cantidad:20,balanceConsumo:{inventarioInicial:0,traslado:0}}});
  await f.move('Almacén','B.Medio',3,'consumo');
  await f.count('Almacén',15);await f.count('B.Chocolatt',0);
  assert.equal(f.rows()[1][4],2);assert.equal(f.record('Almacén').balanceConsumoVersion,2);
  await f.count('Almacén',16);assert.equal(f.rows()[1][4],1);
});

test('expanded count zones never expand Consumo destinations or allow Auxiliar counts', async () => {
  const f=fixture();assert.equal(COUNT_ZONES.length,4);
  for(const zone of ['Almacén','B.Chocolatt','Auxiliar']) {
    await assert.rejects(f.move('Auxiliar',zone,1,'consumo'));
    await assert.rejects(f.api.saveSignedTransfer({product:f.product,origin:'Auxiliar',destination:zone,amount:1},signature));
  }
  await assert.rejects(f.count('Auxiliar',0));
});
