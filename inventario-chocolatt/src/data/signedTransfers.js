import { CONSUMPTION_DESTINATIONS, COUNT_ZONES, ZONES, quantity, roundQty, stock, stockKey } from '../domain/inventory.js';
import { productQuantity } from '../domain/softDrinks.js';
const collection = 'trasladosConsumo';
const period = record => record?.periodoConsumo ?? 'legacy';
const sequence = record => record?.movimientoSeq ?? 0;
function checkSignature(signature) {
  if (typeof signature !== 'string' || signature.length < 200 || signature.length > 250000 || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(signature)) throw new Error('Firma en el recuadro antes de aceptar.');
}
function sameVersion(current, expected) {
  if (!current || current.revision !== expected.revision) throw new Error('Este traslado ha cambiado en otro dispositivo. Revisa la lista.');
}
export function signedTransfers(store, { assertProduct, updatedStock, consumptionBalance }) {
  async function change(draft, signature, previous) {
    if (draft) {
      checkSignature(signature);
      if (!ZONES.includes(draft.origin) || !CONSUMPTION_DESTINATIONS.includes(draft.destination) || draft.origin === draft.destination) throw new Error('Selecciona un origen y una barra de destino distintos.');
    }
    const amount = draft ? productQuantity(draft.amount, draft.product, false) : 0;
    const id = previous?.id ?? store.id(), revision = store.id();
    return store.transact(async tx => {
      const old = previous ? await tx.get(`${collection}/${id}`) : null;
      if (previous) sameVersion(old, previous);
      if (draft) await assertProduct(tx, draft.product);
      if (old && (!draft || old.productId !== draft.product.id)) await assertProduct(tx, { id: old.productId, nombre: old.producto, categoria: old.categoria });
      const keys = new Set(old?.effects.map(e => e.key) ?? []);
      const freshLegs = draft ? [
        ...(draft.origin === 'Auxiliar' ? [] : [{ key: stockKey(draft.product.nombre, draft.origin), zone: draft.origin, delta: -amount, field: 'inventarioInicial' }]),
        { key: stockKey(draft.product.nombre, draft.destination), zone: draft.destination, delta: amount, field: 'traslado' },
      ] : [];
      freshLegs.forEach(e => keys.add(e.key));
      const records = new Map(await Promise.all([...keys].map(async key => [key, await tx.get(`inventario/${key}`)])));
      const changes = new Map();
      const getChange = (key, zone) => {
        if (!changes.has(key)) {
          const record = records.get(key);
          changes.set(key, { key, zone, record, amount: stock(record), balance: COUNT_ZONES.includes(zone) ? consumptionBalance(record, zone) : null, count: record?.recuento ? { ...record.recuento } : null, countChanged: false });
        }
        return changes.get(key);
      };
      function apply(effect, delta, beforeCount) {
        const item = getChange(effect.key, effect.zone);
        if (item.balance) item.balance[effect.field] = roundQty(item.balance[effect.field] + delta);
        if (beforeCount && item.count) {
          item.count.inventarioInicial ??= item.count.teorico;
          item.count.traslado ??= 0;
          item.count[effect.field] = roundQty(item.count[effect.field] + delta);
          item.countChanged = true;
        } else item.amount = roundQty(item.amount + delta);
      }
      const included = new Map();
      for (const effect of old?.effects ?? []) {
        const record = records.get(effect.key);
        if (period(record) !== effect.period) throw new Error('Se ha cerrado o reiniciado el inventario desde este traslado. Vacía la lista antigua antes de registrar el siguiente período.');
        const beforeCount = Boolean(record?.recuento && effect.seq <= (record.recuento.movimientoSeq ?? 0));
        included.set(effect.key, beforeCount);
        apply(effect, -effect.delta, beforeCount);
      }
      const effects = freshLegs.map(leg => {
        const record = records.get(leg.key), prior = old?.effects.find(e => e.key === leg.key);
        const effect = { ...leg, period: period(record), seq: included.get(leg.key) ? prior.seq : sequence(record) + 1 };
        apply(effect, leg.delta, included.get(leg.key));
        return effect;
      });
      const writes = [];
      for (const item of changes.values()) {
        if (item.amount < 0) throw new Error('No hay existencias suficientes para corregir o eliminar este traslado. Revisa los movimientos posteriores.');
        const extra = { movimientoSeq: sequence(item.record) + 1 };
        if (item.balance) {
          if (item.balance.traslado < 0) throw new Error('El acumulado de traslados ha cambiado. Revisa el período de consumo.');
          extra.balanceConsumo = item.balance;
        }
        if (item.countChanged) {
          if (item.count.traslado < 0) throw new Error('El traslado no coincide con el recuento actual.');
          item.count.teorico = roundQty(item.count.inventarioInicial + item.count.traslado);
          item.count.diferencia = roundQty(item.count.teorico - item.count.fisico);
          item.count.consumo = Math.max(0, item.count.diferencia);
          item.count.id = revision;
          extra.recuento = item.count;
        }
        writes.push([`inventario/${item.key}`, updatedStock(item.record, quantity(item.amount), revision, extra)]);
      }
      writes.forEach(([key, value]) => tx.set(key, value));
      if (draft) tx.set(`${collection}/${id}`, {
        productId: draft.product.id, producto: draft.product.nombre, categoria: draft.product.categoria,
        origin: draft.origin, destination: draft.destination, amount, signature, revision, effects,
        orden: old?.orden ?? Date.now(), fecha: store.timestamp(),
      });
      else tx.delete(`${collection}/${id}`);
    });
  }
  return {
    saveSignedTransfer: (draft, signature, previous = null) => change(draft, signature, previous),
    deleteSignedTransfer: previous => change(null, null, previous),
    async clearSignedTransfers(list) {
      if (!list.length) return;
      for (let offset = 0; offset < list.length; offset += 400) {
        const batch = list.slice(offset, offset + 400);
        await store.transact(async tx => {
          const records = await Promise.all(batch.map(t => tx.get(`${collection}/${t.id}`)));
          records.forEach((record, index) => sameVersion(record, batch[index]));
          batch.forEach(t => tx.delete(`${collection}/${t.id}`));
        });
      }
    },
  };
}
