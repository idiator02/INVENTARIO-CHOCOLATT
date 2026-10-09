import { useRememberedSelection } from '../hooks/useRememberedSelection.js';
import { useState } from 'react';
import { CONSUMPTION_DESTINATIONS, ZONES, ZONE_LABELS, getStock, roundQty, tryQuantity } from '../domain/inventory.js';
import BoxQuantity from '../components/BoxQuantity.jsx';
import { formatStock, isSoftDrink, tryProductQuantity } from '../domain/softDrinks.js';
import ProductSelector from '../components/ProductSelector.jsx';
import Modal from '../components/Modal.jsx';
import SignaturePad from '../components/SignaturePad.jsx';
import { exportTransfers } from '../data/exportExcel.js';
import Icon from '../components/Icon.jsx';

export default function Consumo({ products, inventory, repository, canWrite, busy, run, transfers = [], transfersSynced, transfersError }) {
  const [selectedId, setSelectedId] = useRememberedSelection('Consumo.product', '');
  const [origin, setOrigin] = useRememberedSelection('Consumo.origin', 'Almacén');
  const [destination, setDestination] = useRememberedSelection('Consumo.destination', 'B.Medio');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null), [pending, setPending] = useState(null), [signature, setSignature] = useState(''), [confirmation, setConfirmation] = useState(null);
  const writable = canWrite && transfersSynced && !transfersError;
  const product = products.find(p => p.id === selectedId);
  const amount = tryProductQuantity(text, product, false);
  const from = product ? getStock(inventory, product.nombre, origin) : 0;
  const to = product ? getStock(inventory, product.nombre, destination) : 0;
  const error = origin === destination ? 'El origen y el destino deben ser distintos.'
    : amount !== null && origin !== 'Auxiliar' && amount > from + (editing && editing.productId === product?.id && editing.origin === origin ? editing.amount : 0) ? `Solo hay ${formatStock(product, from)} disponibles en ${ZONE_LABELS[origin]}.`
    : text && amount === null ? (isSoftDrink(product) ? 'Introduce cajas o sueltos enteros; el total debe ser mayor que cero.' : 'Introduce una cantidad mayor que cero, con hasta dos decimales.') : '';
  function submit(event) {
    event.preventDefault();
    if (!product || amount === null || error) return;
    setSignature('');
    setPending({ product, origin, destination, amount, previous: editing });
  }
  async function accept() {
    if (!signature || !pending) return;
    if (await run(() => repository.saveSignedTransfer(pending, signature, pending.previous), 'Traslado firmado y guardado.')) {
      setPending(null); setSignature(''); setEditing(null); setText('');
    }
  }
  function edit(transfer) {
    setEditing(transfer); setSelectedId(transfer.productId); setOrigin(transfer.origin); setDestination(transfer.destination); setText(String(transfer.amount));
    document.getElementById('consumo-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function confirm() {
    const clear = confirmation.type === 'clear';
    if (await run(() => clear ? repository.clearSignedTransfers(confirmation.list) : repository.deleteSignedTransfer(confirmation.transfer), clear ? 'Registros seleccionados eliminados. El inventario se conserva.' : 'Traslado eliminado y existencias ajustadas.')) {
      setConfirmation(null); setEditing(null); setText('');
    }
  }
  const download = () => run(() => exportTransfers(transfers), 'Excel de traslados preparado.', false);
  return <div className="consumo-workspace stack">{transfersError && <div className="notice error" role="alert">No se puede acceder a los traslados firmados. Revisa el permiso de la colección trasladosConsumo en Firebase.</div>}<form id="consumo-form" className="card transfer-card" onSubmit={submit}>
    <fieldset disabled={busy || !writable}><div className="card-body">
      <div className="section-label"><span className="step">01</span> ORIGEN</div>
      <label className="field"><span>Origen</span><select value={origin} onChange={event => setOrigin(event.target.value)}>{ZONES.map(zone => <option key={zone} value={zone}>{ZONE_LABELS[zone]}</option>)}</select><small>{origin === 'Auxiliar' ? 'Entrada externa · sin stock' : `${formatStock(product, from)} disponibles`}</small></label>
      <div className="section-label"><span className="step">02</span> PRODUCTO</div>
      <ProductSelector products={products} selected={product} onChange={id => { setSelectedId(id); setText(''); }} disabled={busy || !writable} />
      <div className="section-label"><span className="step">03</span> DESTINO</div>
      <div className="zone-toggle" aria-label="Barra de destino">{CONSUMPTION_DESTINATIONS.map(zone => <button key={zone} type="button" aria-pressed={destination === zone} className={destination === zone ? 'selected' : ''} onClick={() => setDestination(zone)}>{ZONE_LABELS[zone]}</button>)}</div>
      <div className="section-label"><span className="step">04</span> CANTIDAD</div>
      {isSoftDrink(product) ? <BoxQuantity value={text} onChange={setText} /> : (<div className="quantity-control">
        <button type="button" className="quantity-step" aria-label="Restar una unidad" onClick={() => setText(String(Math.max(0, roundQty((tryQuantity(text) ?? 0) - 1))))}><Icon name="minus" /></button>
        <label><span className="sr-only">Cantidad a mover</span><input type="text" inputMode="decimal" autoComplete="off" value={text} onChange={event => setText(event.target.value)} placeholder="0" aria-describedby="consumo-hint" /></label>
        <button type="button" className="quantity-step" aria-label="Añadir una unidad" onClick={() => setText(String(Math.min(1000000, roundQty((tryQuantity(text) ?? 0) + 1))))}><Icon name="plus" /></button>
      </div>)}
      <p id="consumo-hint" className={error ? 'inline-error centered' : 'hint centered'}>{error || (isSoftDrink(product) ? 'Los movimientos se guardan en unidades totales.' : 'Admite decimales con coma o punto.')}</p>
      {product && amount !== null && !error && <div className="transfer-preview"><span>Después del movimiento</span><strong>{origin === 'Auxiliar' ? 'Auxiliar: 0' : `${origin}: ${formatStock(product, roundQty(from - amount))}`}<Icon name="arrow" size={16} />{destination}: {formatStock(product, roundQty(to + amount))}</strong></div>}
      <button type="submit" className="button primary full" disabled={!product || amount === null || Boolean(error)}><Icon name="transfer" />{editing ? 'Guardar cambios y firmar' : 'Añadir'}</button>
      {editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setText(''); }}>Cancelar edición</button>}
    </div></fieldset>
  </form>
  <section className="card"><div className="toolbar"><div><h2>Traslados registrados</h2><p className="muted">Solo movimientos de Consumo</p></div><button type="button" className="button secondary" disabled={!transfers.length || busy} onClick={download}><Icon name="download" />Descargar traslados</button></div>
    {!transfers.length ? <p className="picker-empty">Los traslados aparecerán aquí al aceptar la firma.</p> : <div className="signed-list">{transfers.map(t => <article className="signed-item" key={t.id}>
      <div><span className="badge">{ZONE_LABELS[t.destination]}</span><h3>{t.producto}</h3><p className="muted">{ZONE_LABELS[t.origin]} → {ZONE_LABELS[t.destination]} · {formatStock(t, t.amount)}</p></div>
      <img className="signature-preview" src={t.signature} alt={`Firma de recepción de ${t.producto}`} />
      <div className="count-actions"><button type="button" className="icon-button" disabled={!writable || busy} aria-label={`Editar traslado de ${t.producto}`} onClick={() => edit(t)}><Icon name="edit" /></button><button type="button" className="icon-button subtle-danger" disabled={!writable || busy} aria-label={`Eliminar traslado de ${t.producto}`} onClick={() => setConfirmation({ type: 'delete', transfer: t })}><Icon name="trash" /></button></div>
    </article>)}</div>}
    <div className="card-footer"><button type="button" className="text-button" disabled={!transfers.length || !writable || busy} onClick={() => setConfirmation({ type: 'clear', list: transfers })}>Vaciar consumo</button></div>
  </section>
  {pending && <Modal title={pending.previous ? 'Firmar corrección del traslado' : 'Firmar traslado'} busy={busy} onClose={() => setPending(null)}>
    <p><strong>{pending.product.nombre}</strong> · {formatStock(pending.product, pending.amount)}<br />{ZONE_LABELS[pending.origin]} → {ZONE_LABELS[pending.destination]}</p>
    <SignaturePad onChange={setSignature} disabled={busy} />
    <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setPending(null)}>Cancelar</button><button type="button" className="button primary" disabled={!signature || !writable || busy} onClick={accept}>{busy ? 'Guardando…' : 'Aceptar'}</button></div>
  </Modal>}
  {confirmation && <Modal title={confirmation.type === 'clear' ? 'Vaciar consumo' : 'Eliminar traslado'} busy={busy} onClose={() => setConfirmation(null)}>
    <p>{confirmation.type === 'clear' ? `Se borrarán ${confirmation.list.length} registros y sus firmas de la lista. El inventario y los recuentos no cambiarán. Descarga antes el Excel para conservarlos.` : 'Se eliminará este traslado y se revertirá su efecto en las existencias o en el recuento correspondiente.'}</p>
    <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button><button type="button" className="button primary" disabled={!writable || busy} onClick={confirm}>Aceptar</button></div>
  </Modal>}
  </div>;
}
