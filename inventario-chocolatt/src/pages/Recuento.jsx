import { useRememberedSelection } from '../hooks/useRememberedSelection.js';
import { useState } from 'react';
import { COUNT_ZONES, ZONE_LABELS, formatQty, getStock, roundQty, stockKey, countToken } from '../domain/inventory.js';
import { incompleteChocolattCounts } from '../domain/countGroups.js';
import { Empty } from '../components/Fields.jsx';
import BoxQuantity from '../components/BoxQuantity.jsx';
import { formatStock, isSoftDrink, tryProductQuantity } from '../domain/softDrinks.js';
import ProductSelector from '../components/ProductSelector.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
export default function Recuento({ products, inventory, counts, repository, canWrite, busy, run, exportCounts }) {
  const [selectedId, setSelectedId] = useRememberedSelection('Recuento.product', '');
  const [zone, setZone] = useRememberedSelection('Recuento.zone', 'B.Medio'), [text, setText] = useState(''), [baseline, setBaseline] = useState(null);
  const [confirmation, setConfirmation] = useState(null), [confirmText, setConfirmText] = useState('');
  const incomplete = incompleteChocolattCounts(counts);
  const product = selectedId ? products.find(p => p.id === selectedId) : products[0];
  const record = product ? inventory[stockKey(product.nombre, zone)] : undefined;
  const theoretical = record?.recuento?.teorico ?? (product ? getStock(inventory, product.nombre, zone) : 0);
  const amount = tryProductQuantity(text, product);
  const changed = baseline !== null && baseline !== countToken(record);
  const resetInput = () => { setText(''); setBaseline(null); };
  async function submit(event) {
    event.preventDefault();
    if (!product || amount === null || changed) return;
    if (await run(() => repository.saveCount(product, zone, amount, baseline ?? countToken(record)), `Recuento de ${product.nombre} guardado en ${ZONE_LABELS[zone]}.`)) resetInput();
  }
  function edit(count) {
    const product = products.find(p => p.nombre === count.producto && p.categoria === count.categoria);
    if (!product) return;
    setSelectedId(product.id); setZone(count.zona); setText(String(count.fisico)); setBaseline(countToken(inventory[count.key]));
    document.getElementById('count-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const close = () => { setConfirmation(null); setConfirmText(''); };
  async function confirm() {
    const ok = await run(() => confirmation.type === 'undo' ? repository.undoCount(confirmation.count) : repository.clearCounts(confirmation.counts), confirmation.type === 'undo' ? 'Recuento deshecho y existencias restauradas.' : 'Lista vaciada. Las existencias se conservan.');
    if (ok) { resetInput(); close(); }
  }
  return <div className="stack">
    <div className="workspace-grid">
      <form className="card" id="count-form" onSubmit={submit}><fieldset disabled={!canWrite || busy}><div className="card-body form-stack"><div className="zone-toggle count-zone-toggle" aria-label="Barra a recontar">{COUNT_ZONES.map(z => <button type="button" key={z} aria-pressed={zone === z} className={zone === z ? 'selected' : ''} onClick={() => { setZone(z); resetInput(); }}>{ZONE_LABELS[z]}</button>)}</div><ProductSelector disabled={!canWrite || busy} products={products} selected={product} onChange={id => { setSelectedId(id); resetInput(); }} /><div className={`count-values${isSoftDrink(product) ? ' count-values-boxes' : ''}`}><div><span>Stock teórico</span><strong>{formatStock(product, theoretical)}</strong></div>{isSoftDrink(product) ? <BoxQuantity label="Cantidad que queda" value={text} onChange={value => { if (product) setSelectedId(product.id); if (baseline === null) setBaseline(countToken(record)); setText(value); }} /> : (<label className="field"><span>Cantidad que queda</span><input type="text" inputMode="decimal" autoComplete="off" value={text} placeholder="0" onChange={event => { if (product) setSelectedId(product.id); if (baseline === null) setBaseline(countToken(record)); setText(event.target.value); }} /></label>)}</div>
      {text && amount === null && <p className="inline-error">{isSoftDrink(product) ? 'Introduce cajas o sueltos enteros. Para indicar cero, escribe 0.' : 'Introduce cero o una cantidad positiva, con hasta dos decimales.'}</p>}
      {amount !== null && !changed && <div className={amount > theoretical ? 'notice warning' : 'count-preview'}>{amount > theoretical ? <span>Hay {formatQty(roundQty(amount - theoretical))} más de lo esperado. Se registrará el sobrante y el consumo será 0.</span> : <><span>Consumo calculado</span><strong>{formatQty(roundQty(theoretical - amount))}</strong></>}</div>}
      {record?.recuento && <p className="hint">Corriges la cantidad que había al realizar este recuento. Los movimientos posteriores se conservan.</p>}
      {changed && <div className="notice warning">Las existencias han cambiado mientras contabas. Revisa el stock y vuelve a introducir la cantidad.<button type="button" className="text-button" onClick={resetInput}>Actualizar formulario</button></div>}
      <button className="button primary full" disabled={!product || amount === null || changed}><Icon name="check" />{busy ? 'Guardando…' : record?.recuento ? 'Corregir recuento' : 'Guardar recuento'}</button><p className="hint centered">Actualiza el stock global al confirmar.</p></div></fieldset></form>
      <aside className="side-stack"><section className="card count-summary"><span className="eyebrow">RECUENTO EN CURSO</span><div className="large-number">{counts.length}<span>productos por barra</span></div>{COUNT_ZONES.map(z => <div className="summary-row" key={z}><span>{ZONE_LABELS[z]}</span><strong>{counts.filter(c => c.zona === z).length}</strong></div>)}<span className="saved-note"><Icon name="check" size={16} />Guardado junto a tus existencias</span></section><section className="note-card"><Icon name="info" /><div><h3>Al terminar la noche</h3><p>Cuenta cada producto en Chocolatt y Almacén por separado, incluso si queda cero. En el Excel se suman como Barra Chocolatt. Medio y Chica se mantienen separadas. La diferencia con el stock teórico es el consumo. Descarga el Excel antes de vaciar la lista para el siguiente recuento.</p></div></section></aside>
    </div>
    <section className="card"><div className="toolbar"><div><h2>Productos recontados</h2><p className="muted">Excel: Barra Chocolatt (incluye Almacén), Barra Medio y Barra Chica</p></div><button className="button secondary" disabled={!counts.length || busy} onClick={exportCounts}><Icon name="download" />Descargar consumo</button></div>
    {incomplete.length > 0 && <p className="notice warning">Para descargar el total de Chocolatt falta completar: {incomplete.map(c => `${c.producto} en ${ZONE_LABELS[c.zona]}`).join('; ')}. Cuenta también los ceros.</p>}
    {counts.length ? <div className="count-list">{counts.map(c => <article className="count-item" key={c.key}><div className="count-item-title"><span className="badge">{ZONE_LABELS[c.zona]}</span><h3>{c.producto}</h3></div><dl><div><dt>Teórico</dt><dd>{formatStock(c, c.teorico)}</dd></div><div><dt>Queda</dt><dd>{formatStock(c, c.fisico)}</dd></div><div className="consumption"><dt>Consumo</dt><dd>{formatQty(c.consumo)}</dd></div>{c.diferencia < 0 && <div><dt>Sobrante</dt><dd>{formatQty(-c.diferencia)}</dd></div>}</dl><div className="count-actions"><button className="icon-button" disabled={!canWrite || busy} aria-label={`Corregir ${c.producto} en ${c.zona}`} onClick={() => edit(c)}><Icon name="edit" size={18} /></button><button className="icon-button subtle-danger" disabled={!canWrite || busy} aria-label={`Deshacer ${c.producto} en ${c.zona}`} onClick={() => setConfirmation({ type: 'undo', count: c })}><Icon name="undo" size={18} /></button></div></article>)}</div> : <Empty title="Todo listo para empezar">Los recuentos confirmados aparecerán aquí y se conservarán al cerrar la app.</Empty>}
    {counts.length > 0 && <div className="card-footer"><button className="text-button" disabled={!canWrite || busy} onClick={() => setConfirmation({ type: 'clear', counts })}>Vaciar lista para el siguiente recuento</button></div>}</section>
    {confirmation && <Modal title={confirmation.type === 'undo' ? 'Deshacer recuento' : 'Vaciar lista de recuento'} onClose={close} busy={busy}>{confirmation.type === 'undo' ? <p>Se eliminará el recuento de <strong>{confirmation.count.producto}</strong> en {ZONE_LABELS[confirmation.count.zona]} y se revertirá su ajuste de existencias, conservando los movimientos posteriores.</p> : <><p>Se eliminarán los {confirmation.counts.length} recuentos seleccionados para todos los dispositivos. El stock actual se conservará. Descarga antes el Excel si quieres guardar el consumo.</p><button className="button secondary" disabled={busy} onClick={exportCounts}><Icon name="download" />Descargar consumo</button><label className="field confirm-field"><span>Escribe LIMPIAR para confirmar</span><input value={confirmText} onChange={event => setConfirmText(event.target.value)} autoComplete="off" disabled={busy} /></label></>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" onClick={confirm} disabled={!canWrite || busy || (confirmation.type === 'clear' && confirmText !== 'LIMPIAR')}>{busy ? 'Guardando…' : 'Confirmar'}</button></div></Modal>}
  </div>;
}
