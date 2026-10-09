import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOperations } from '../src/data/operations.js';
import { createMemoryStore } from '../src/data/memoryStore.js';
import { activeCounts, countToken } from '../src/domain/inventory.js';
const signature = `data:image/png;base64,${readFileSync(new URL('./fixtures/signature.png',import.meta.url)).toString('base64')}`;
const product = { id: 'ron', nombre: 'Ron', categoria: 'Alcohol' };
const other = { id: 'cola', nombre: 'Cola', categoria: 'Refrescos' };
function fixture(commit) {
 const store=createMemoryStore({'productos/ron':product,'productos/cola':other,'inventario/Ron-Almacén':{cantidad:20},'inventario/Ron-B.Medio':{cantidad:5},'inventario/Cola-Almacén':{cantidad:96}},commit);
 const api=createOperations(store);
 const record=(zone,name='Ron')=>store.dump()[`inventario/${name}-${zone}`];
 const inventory=()=>Object.fromEntries(Object.entries(store.dump()).filter(([key])=>key.startsWith('inventario/')).map(([key,value])=>[key.slice(11),value]));
 const list=()=>Object.entries(store.dump()).filter(([key])=>key.startsWith('trasladosConsumo/')).map(([key,value])=>({...value,id:key.slice('trasladosConsumo/'.length)}));
 const draft=(amount=3,origin='Almacén',destination='B.Medio',p=product)=>({product:p,origin,destination,amount});
 return {store,api,record,inventory,list,draft};
}
test('signature required and confirmed movement atomically persists stock and signature',async()=>{
 const f=fixture(),before=f.store.dump();
 await assert.rejects(f.api.saveSignedTransfer(f.draft(),''),/Firma/);assert.deepEqual(f.store.dump(),before);
 await f.api.saveSignedTransfer(f.draft(),signature);
 assert.equal(f.list().length,1);assert.equal(f.list()[0].signature,signature);
 assert.equal(f.record('Almacén').cantidad,17);assert.equal(f.record('B.Medio').cantidad,8);
 assert.deepEqual(f.record('B.Medio').balanceConsumo,{inventarioInicial:5,traslado:3});
});
test('editing amount applies only the difference and deletion reverses that movement',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(),signature);
 await f.api.saveSignedTransfer(f.draft(4.5),signature,f.list()[0]);
 assert.equal(f.list().length,1);assert.equal(f.record('Almacén').cantidad,15.5);assert.equal(f.record('B.Medio').cantidad,9.5);
 await f.api.deleteSignedTransfer(f.list()[0]);
 assert.equal(f.list().length,0);assert.equal(f.record('Almacén').cantidad,20);assert.equal(f.record('B.Medio').cantidad,5);
 assert.equal(f.record('B.Medio').balanceConsumo.traslado,0);
});
test('editing product, origin and destination reverses old route and applies new route',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(),signature);
 await f.api.saveSignedTransfer(f.draft(24,'Auxiliar','B.Chica',other),signature,f.list()[0]);
 assert.equal(f.record('Almacén').cantidad,20);assert.equal(f.record('B.Medio').cantidad,5);
 assert.equal(f.record('B.Chica','Cola').cantidad,24);assert.equal(f.record('Auxiliar','Cola'),undefined);
 assert.equal(f.list()[0].producto,'Cola');
});
test('pre-count movement correction changes theoretical and consumption, never the counted physical stock',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(),signature);
 await f.api.saveCount(product,'B.Medio',2,countToken(f.record('B.Medio')));
 const oldCount=activeCounts(f.inventory())[0];
 await f.api.saveSignedTransfer(f.draft(4),signature,f.list()[0]);
 assert.equal(f.record('B.Medio').cantidad,2);assert.equal(f.record('B.Medio').recuento.fisico,2);
 assert.equal(f.record('B.Medio').recuento.teorico,9);assert.equal(f.record('B.Medio').recuento.consumo,7);
 await assert.rejects(f.api.undoCount(oldCount),/ha cambiado/);
 await f.api.deleteSignedTransfer(f.list()[0]);
 assert.equal(f.record('B.Medio').cantidad,2);assert.equal(f.record('B.Medio').recuento.teorico,5);assert.equal(f.record('B.Medio').recuento.consumo,3);
 await f.api.undoCount(activeCounts(f.inventory())[0]);assert.equal(f.record('B.Medio').cantidad,5);
});
test('post-count movement editing affects stock without changing the earlier count',async()=>{
 const f=fixture();await f.api.saveCount(product,'B.Medio',2,countToken(f.record('B.Medio')));
 await f.api.saveSignedTransfer(f.draft(),signature);
 await f.api.saveSignedTransfer(f.draft(4),signature,f.list()[0]);
 assert.equal(f.record('B.Medio').cantidad,6);assert.equal(f.record('B.Medio').recuento.consumo,3);
 await f.api.deleteSignedTransfer(f.list()[0]);assert.equal(f.record('B.Medio').cantidad,2);
});
test('inter-bar signed transfer and reversal preserve both bars and count consumption',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(2,'B.Medio','B.Chica'),signature);
 await f.api.saveCount(product,'B.Medio',1,countToken(f.record('B.Medio')));
 await f.api.saveCount(product,'B.Chica',1,countToken(f.record('B.Chica')));
 await f.api.deleteSignedTransfer(f.list()[0]);
 assert.equal(f.record('B.Medio').cantidad,1);assert.equal(f.record('B.Medio').recuento.consumo,4);
 assert.equal(f.record('B.Chica').cantidad,1);assert.equal(f.record('B.Chica').recuento.consumo,0);
});
test('clearing only removes listed transfers and leaves every inventory byte unchanged',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(),signature);
 const list=f.list();await f.api.saveSignedTransfer(f.draft(2),signature);
 const before=f.inventory();await f.api.clearSignedTransfers(list);
 assert.deepEqual(f.inventory(),before);assert.equal(f.list().length,1);assert.equal(f.list()[0].amount,2);
});
test('concurrent edits reject stale signatures and concurrent transfers preserve stock',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(),signature);const old=f.list()[0];
 const edits=await Promise.allSettled([f.api.saveSignedTransfer(f.draft(4),signature,old),f.api.saveSignedTransfer(f.draft(5),signature,old)]);
 assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(f.api.clearSignedTransfers([old]),/ha cambiado/);
 await Promise.all([f.api.saveSignedTransfer(f.draft(2),signature),f.api.saveSignedTransfer(f.draft(1),signature)]);
 const moved=f.list().reduce((sum,t)=>sum+t.amount,0);
 assert.equal(f.record('B.Medio').cantidad,5+moved);assert.equal(f.record('Almacén').cantidad,20-moved);
});
test('insufficient stock, closed period and failed commit do not partially change inventory',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(),signature);const before=f.store.dump();
 await assert.rejects(f.api.saveSignedTransfer(f.draft(100),signature,f.list()[0]),/suficientes/);assert.deepEqual(f.store.dump(),before);
 await f.api.saveCount(product,'B.Medio',2,countToken(f.record('B.Medio')));await f.api.clearCounts(activeCounts(f.inventory()));
 const closed=f.store.dump();await assert.rejects(f.api.deleteSignedTransfer(f.list()[0]),/cerrado/);assert.deepEqual(f.store.dump(),closed);
 const failed=fixture(()=>{throw new Error('permission-denied')});const original=failed.store.dump();
 await assert.rejects(failed.api.saveSignedTransfer(failed.draft(),signature),/permission/);assert.deepEqual(failed.store.dump(),original);
});
test('signed transfers survive reopening the transaction store',async()=>{
 const f=fixture();await f.api.saveSignedTransfer(f.draft(),signature);
 const store=createMemoryStore(f.store.dump()), api=createOperations(store);
 await api.deleteSignedTransfer(f.list()[0]);
 assert.equal(store.dump()['inventario/Ron-B.Medio'].cantidad,5);
});

test('clear supports more than one batch without touching stock or new rows',async()=>{
 const data={'inventario/Ron-B.Medio':{cantidad:7}};
 const list=Array.from({length:405},(_,i)=>({id:`row-${i}`,revision:`rev-${i}`}));
 list.forEach(t=>{data[`trasladosConsumo/${t.id}`]={revision:t.revision};});
 data['trasladosConsumo/new']={revision:'new'};
 const store=createMemoryStore(data),api=createOperations(store);
 await api.clearSignedTransfers(list);
 assert.deepEqual(store.dump(),{'inventario/Ron-B.Medio':{cantidad:7},'trasladosConsumo/new':{revision:'new'}});
});
