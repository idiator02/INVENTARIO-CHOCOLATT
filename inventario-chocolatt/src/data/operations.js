import { signedTransfers } from './signedTransfers.js';
import { productQuantity } from '../domain/softDrinks.js';
import { CATEGORIES, CONSUMPTION_DESTINATIONS, COUNT_ZONES, DEFAULT_PRODUCTS, REAL_ZONES, ZONES, countToken, formatQty, normalizeName, productId, quantity, roundQty, stock, stockKey, stockToken, validProductName } from '../domain/inventory.js';

// Every stock mutation uses this transaction contract in Firebase and tests.
// All reads precede writes, as required by Firestore.
export function createOperations(store) {
  const path = (product, zone) => `inventario/${stockKey(product.nombre, zone)}`;
  const assertProduct = async (tx, product) => {
    if (!product?.id) throw new Error('Selecciona un producto.');
    const current = await tx.get(`productos/${product.id}`);
    if (!current || current.nombre !== product.nombre || current.categoria !== product.categoria) throw new Error('El catálogo ha cambiado. Vuelve a seleccionar el producto.');
  };
  const updatedStock = (record, amount, revision, extra = {}) => ({ ...record, cantidad: quantity(amount), balanceConsumoVersion: 2, revision, actualizadoEn: store.timestamp(), ...extra });
  const assertExpected = (record, expected) => {
    if (stockToken(record) !== expected) throw new Error('Las existencias o el recuento han cambiado. Revisa los datos y vuelve a introducir la cantidad.');
  };
  const correctedStock = (record, physical) => {
    const amount = roundQty(stock(record) + physical - record.recuento.fisico);
    if (amount < 0) throw new Error('Esta corrección dejaría existencias negativas tras los movimientos posteriores. Revisa la cantidad y esos movimientos. No se ha modificado ningún dato.');
    return quantity(amount);
  };
  // These counters describe the current counting period; cantidad remains the only stock.
  // Older versions did not record the screen of origin, so their stock is opening balance.
  const consumptionBalance = (record, zone) => {
    const expected = roundQty(stock(record) + (record?.recuento ? record.recuento.teorico - record.recuento.fisico : 0));
    // Old versions did not maintain counters for these two locations, including after resets.
    const legacyLocation = ['B.Chocolatt', 'Almacén'].includes(zone) && record?.balanceConsumoVersion !== 2;
    const balance = (legacyLocation ? null : record?.balanceConsumo) ?? { inventarioInicial: expected, traslado: 0 };
    if (!Number.isFinite(balance.inventarioInicial) || !Number.isFinite(balance.traslado) || balance.traslado < 0 || roundQty(balance.inventarioInicial + balance.traslado) !== expected) {
      throw new Error('El desglose de movimientos no coincide con las existencias. Revisa si otro dispositivo ha usado una versión anterior antes de continuar. No se ha guardado ningún cambio.');
    }
    return { ...balance };
  };
  const movedStock = (record, zone, delta, source, revision) => {
    const extra = { movimientoSeq: (record?.movimientoSeq ?? 0) + 1 };
    if (COUNT_ZONES.includes(zone)) {
      const balance = consumptionBalance(record, zone);
      // Outgoing stock reduces the opening balance, never the bar's consumption.
      const field = delta > 0 && source === 'consumo' ? 'traslado' : 'inventarioInicial';
      balance[field] = roundQty(balance[field] + delta);
      extra.balanceConsumo = balance;
    }
    return updatedStock(record, roundQty(stock(record) + delta), revision, extra);
  };
  return {
    ...signedTransfers(store, { assertProduct, updatedStock, consumptionBalance }),
    async transfer(product, origin, destination, input, source = 'traspasos') {
      const amount = productQuantity(input, product, false);
      if (!['traspasos', 'consumo'].includes(source)) throw new Error('El origen del movimiento no es válido.');
      if (source === 'consumo' && !CONSUMPTION_DESTINATIONS.includes(destination)) throw new Error('Desde Consumo, el destino debe ser Barra Medio o Barra Chica.');
      if (!ZONES.includes(origin) || !ZONES.includes(destination)) throw new Error('Selecciona un origen y un destino válidos.');
      if (origin === destination) throw new Error('El origen y el destino deben ser distintos.');
      const revision = store.id();
      return store.transact(async tx => {
        await assertProduct(tx, product);
        const from = origin === 'Auxiliar' ? null : await tx.get(path(product, origin));
        const to = destination === 'Auxiliar' ? null : await tx.get(path(product, destination));
        if (origin !== 'Auxiliar' && amount > stock(from)) throw new Error(`No hay existencias suficientes en ${origin}. Disponibles: ${formatQty(stock(from))}.`);
        // Never write an Auxiliar document: it cannot accumulate stock.
        if (origin !== 'Auxiliar') tx.set(path(product, origin), movedStock(from, origin, -amount, source, revision));
        if (destination !== 'Auxiliar') tx.set(path(product, destination), movedStock(to, destination, amount, source, revision));
      });
    },
    async saveCount(product, zone, input, expected) {
      const physical = productQuantity(input, product);
      if (!COUNT_ZONES.includes(zone)) throw new Error('Selecciona Barra Chocolatt, Almacén, Barra Medio o Barra Chica para el recuento.');
      const revision = store.id(), countId = store.id();
      return store.transact(async tx => {
        await assertProduct(tx, product);
        const key = path(product, zone), record = await tx.get(key);
        if (countToken(record) !== expected) throw new Error('Las existencias o el recuento han cambiado. Revisa los datos y vuelve a introducir la cantidad.');
        const balance = consumptionBalance(record, zone);
        // A correction refers to the original count, not to subsequent movements.
        const inventarioInicial = record?.recuento ? record.recuento.inventarioInicial ?? record.recuento.teorico : balance.inventarioInicial;
        const traslado = record?.recuento ? record.recuento.traslado ?? 0 : balance.traslado;
        const theoretical = record?.recuento?.teorico ?? roundQty(inventarioInicial + traslado);
        const difference = roundQty(theoretical - physical);
        const count = { movimientoSeq: record?.recuento?.movimientoSeq ?? record?.movimientoSeq ?? 0, id: countId, revisionStock: revision, producto: product.nombre, categoria: product.categoria, zona: zone, inventarioInicial, traslado, teorico: theoretical, fisico: physical, consumo: Math.max(0, difference), diferencia: difference, fecha: store.timestamp() };
        tx.set(key, updatedStock(record, record?.recuento ? correctedStock(record, physical) : physical, revision, { recuento: count, balanceConsumo: balance }));
      });
    },
    async undoCount(count) {
      const revision = store.id();
      return store.transact(async tx => {
        const key = `inventario/${count.key}`, record = await tx.get(key);
        if (!record?.recuento || record.recuento.id !== count.id) throw new Error('Este recuento ya ha cambiado. Revisa la lista.');
        tx.set(key, updatedStock(record, correctedStock(record, record.recuento.teorico), revision, { recuento: null, balanceConsumo: consumptionBalance(record, count.zona) }));
      });
    },
    async clearCounts(counts) {
      if (!counts.length) return;
      if (counts.length > 400) throw new Error('Hay demasiados recuentos para vaciarlos de una vez. Contacta con el administrador.');
      return store.transact(async tx => {
        const records = await Promise.all(counts.map(c => tx.get(`inventario/${c.key}`)));
        records.forEach((record, i) => { if (record?.recuento?.id !== counts[i].id) throw new Error('El recuento ha cambiado en otro dispositivo. Revisa la lista antes de vaciarla.'); });
        records.forEach((record, i) => tx.set(`inventario/${counts[i].key}`, { ...record, recuento: null, periodoConsumo: store.id(), balanceConsumo: { inventarioInicial: stock(record), traslado: 0 } }));
      });
    },
    async addProduct(input, category) {
      const name = validProductName(input);
      if (!CATEGORIES.includes(category)) throw new Error('Selecciona una categoría válida.');
      // Check legacy IDs; deterministic new IDs also prevent concurrent duplicates.
      const products = await store.products();
      if (products.some(p => normalizeName(p.nombre) === normalizeName(name))) throw new Error('Ya existe un producto con ese nombre.');
      return store.transact(async tx => {
        const key = `productos/${productId(name)}`;
        if (await tx.get(key)) throw new Error('Ya existe un producto con ese nombre.');
        tx.set(key, { nombre: name, categoria: category });
      });
    },
    async deleteProduct(product) {
      return store.transact(async tx => {
        await assertProduct(tx, product);
        const records = await Promise.all(REAL_ZONES.map(zone => tx.get(path(product, zone))));
        if (records.some(record => stock(record) !== 0 || record?.recuento)) throw new Error('Este producto tiene existencias o un recuento pendiente. Déjalo a cero y cierra su recuento antes de eliminarlo.');
        tx.delete(`productos/${product.id}`);
      });
    },
    async seedCatalog() {
      if ((await store.products()).length) throw new Error('El catálogo ya contiene productos.');
      const products = Object.entries(DEFAULT_PRODUCTS).flatMap(([category, names]) => names.map(name => ({ nombre: name, categoria: category })));
      return store.transact(async tx => {
        const existing = await Promise.all(products.map(p => tx.get(`productos/${productId(p.nombre)}`)));
        products.forEach((p, i) => { if (!existing[i]) tx.set(`productos/${productId(p.nombre)}`, p); });
      });
    },
    async resetInventory(inventory) {
      const entries = Object.entries(inventory);
      if (entries.length > 400) throw new Error('El inventario supera 400 registros. El reinicio requiere una operación de administración; no se ha borrado nada.');
      const revision = store.id();
      return store.transact(async tx => {
        const records = await Promise.all(entries.map(([key]) => tx.get(`inventario/${key}`)));
        records.forEach((record, i) => assertExpected(record, stockToken(entries[i][1])));
        records.forEach((record, i) => tx.set(`inventario/${entries[i][0]}`, updatedStock(record, 0, revision, { recuento: null, periodoConsumo: revision, balanceConsumo: { inventarioInicial: 0, traslado: 0 } })));
      });
    },
  };
}
