import test from 'node:test';
import assert from 'node:assert/strict';
import { productQuantity, tryProductQuantity, formatStock, excelQuantity } from '../src/domain/softDrinks.js';
import { activeCounts, countToken } from '../src/domain/inventory.js';
import { inventoryRows, countRows } from '../src/domain/exportRows.js';
import { createOperations } from '../src/data/operations.js';
import { createMemoryStore } from '../src/data/memoryStore.js';
const cola = { id: 'cola', nombre: 'Cola', categoria: 'Refrescos' };
test('boxes and loose convert into total units without decimal truncation', () => {
  assert.equal(productQuantity({ boxes: '4', loose: '12' }, cola), 108);
  assert.equal(productQuantity({ boxes: '', loose: '25' }, cola), 25);
  assert.equal(productQuantity({ boxes: '0', loose: '' }, cola), 0);
  assert.equal(tryProductQuantity({ boxes: '', loose: '' }, cola), null);
  for (const input of [{boxes:'1.5',loose:''},{boxes:'-1',loose:'2'},{boxes:'0',loose:'1,5'},1.5,{boxes:'1000000',loose:'0'}]) assert.throws(() => productQuantity(input,cola));
  assert.equal(productQuantity('1,5',{categoria:'Alcohol'}),1.5);
  assert.equal(formatStock(cola,108),'4-12 = 108');
  assert.equal(formatStock(cola,25),'1-1 = 25');
  assert.equal(formatStock(cola,0),'0-0 = 0');
});
test('boxed transfers and counts use the same numeric stock and consumption breakdown', async () => {
  const store=createMemoryStore({'productos/cola':cola}), api=createOperations(store);
  const path='inventario/Cola-B.Medio';
  await api.transfer(cola,'Auxiliar','B.Medio',{boxes:'4',loose:'12'},'traspasos');
  assert.equal(store.dump()[path].cantidad,108);
  await api.transfer(cola,'Auxiliar','B.Medio',{boxes:'1',loose:'0'},'consumo');
  await api.saveCount(cola,'B.Medio',{boxes:'3',loose:'12'},countToken(store.dump()[path]));
  const inventory={'Cola-B.Medio':store.dump()[path]};
  assert.equal(inventory['Cola-B.Medio'].cantidad,84);
  assert.equal(inventoryRows([cola],inventory)[1][2],3.5);
  assert.deepEqual(countRows(activeCounts(inventory))[1],['Barra Medio','Cola',4.5,1,2,3.5]);
  const before=store.dump();
  await assert.rejects(api.transfer(cola,'B.Medio','B.Chica',.5,'consumo'),/enteras/);
  assert.deepEqual(store.dump(),before);
});

test('export-only box rounding covers every boundary and does not alter units', () => {
  for (const [units, expected] of [[0,0],[8,0],[9,.5],[16,.5],[17,1],[23,1],[24,1],[48,2],[56,2],[57,2.5],[64,2.5],[65,3],[71,3],[72,3],[-57,-2.5]]) assert.equal(excelQuantity(cola, units), expected);
  assert.equal(excelQuantity({categoria:'Alcohol'},2.75),2.75);
  assert.equal(formatStock(cola,57),'2-9 = 57');
});
