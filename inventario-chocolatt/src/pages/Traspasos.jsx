import { useRememberedSelection } from '../hooks/useRememberedSelection.js';
import { useState } from 'react';
import { REAL_ZONES, ZONES, ZONE_LABELS, formatQty, getStock, roundQty, tryQuantity } from '../domain/inventory.js';
import BoxQuantity from '../components/BoxQuantity.jsx';
import { formatStock, isSoftDrink, tryProductQuantity } from '../domain/softDrinks.js';
import ProductSelector from '../components/ProductSelector.jsx';
import Icon from '../components/Icon.jsx';
export default function Traspasos({ products, inventory, repository, canWrite, busy, run }) {
  const [selectedId, setSelectedId] = useRememberedSelection('Traspasos.product', '');
  const [origin, setOrigin] = useRememberedSelection('Traspasos.origin', 'Auxiliar');
  const [destination, setDestination] = useRememberedSelection('Traspasos.destination', 'B.Chocolatt');
  const [text, setText] = useState('');
  const product = selectedId ? products.find(p => p.id === selectedId) : products[0];
  const amount = tryProductQuantity(text, product, false);
  const from = product ? getStock(inventory, product.nombre, origin) : 0;
  const to = product ? getStock(inventory, product.nombre, destination) : 0;
  const insufficient = amount !== null && origin !== 'Auxiliar' && amount > from;
  const sameZone = origin === destination;
  const action = origin === 'Auxiliar' ? 'entrada' : destination === 'Auxiliar' ? 'salida' : 'traspaso';
  const error = sameZone ? 'El origen y el destino deben ser distintos.' : insufficient ? `Solo hay ${formatStock(product, from)} disponibles en ${ZONE_LABELS[origin]}.` : text && amount === null ? (isSoftDrink(product) ? 'Introduce cajas o sueltos enteros; el total debe ser mayor que cero.' : 'Introduce una cantidad mayor que cero, con hasta dos decimales.') : '';
  function updateQuantity(value) {
    if (product) setSelectedId(product.id);
    setText(value);
  }
  async function submit(event) {
    event.preventDefault();
    if (error || amount === null || !product) return;
    const ok = await run(() => repository.transfer(product, origin, destination, amount, 'traspasos'), `${formatQty(amount)} de ${product.nombre}: ${ZONE_LABELS[origin]} → ${ZONE_LABELS[destination]}.`);
    if (ok) setText('');
  }
  return <div className="workspace-grid">
    <form onSubmit={submit} className="card transfer-card">
      <fieldset disabled={busy || !canWrite}>
        <div className="card-body">
          <div className="section-label"><span className="step">01</span> PRODUCTO</div>
          <ProductSelector disabled={busy || !canWrite} products={products} selected={product} onChange={id => { setSelectedId(id); setText(''); }} />
          <div className="section-label"><span className="step">02</span> RECORRIDO</div>
          <div className="route-fields">
            <label className="field"><span>Origen</span><select value={origin} onChange={event => setOrigin(event.target.value)}>{ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}</select><small>{origin === 'Auxiliar' ? 'Entrada externa · sin stock' : `${formatStock(product, from)} disponibles`}</small></label>
            <button type="button" className="swap icon-button" aria-label="Intercambiar origen y destino" onClick={() => { setOrigin(destination); setDestination(origin); }}><Icon name="transfer" /></button>
            <label className="field"><span>Destino</span><select value={destination} onChange={event => setDestination(event.target.value)}>{ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}</select><small>{destination === 'Auxiliar' ? 'Salida externa · sin stock' : `${formatStock(product, to)} actualmente`}</small></label>
          </div>
          <div className="section-label"><span className="step">03</span> CANTIDAD</div>
          {isSoftDrink(product) ? <BoxQuantity value={text} onChange={updateQuantity} /> : (<div className="quantity-control">
            <button type="button" className="quantity-step" aria-label="Restar una unidad" onClick={() => updateQuantity(String(Math.max(0, roundQty((tryQuantity(text) ?? 0) - 1))))}><Icon name="minus" /></button>
            <label><span className="sr-only">Cantidad a mover</span><input type="text" inputMode="decimal" autoComplete="off" value={text} onChange={event => updateQuantity(event.target.value)} placeholder="0" aria-describedby="transfer-hint" /></label>
            <button type="button" className="quantity-step" aria-label="Añadir una unidad" onClick={() => updateQuantity(String(Math.min(1000000, roundQty((tryQuantity(text) ?? 0) + 1))))}><Icon name="plus" /></button>
          </div>)}
          <p id="transfer-hint" className={error ? 'inline-error centered' : 'hint centered'}>{error || (isSoftDrink(product) ? 'Los movimientos se guardan en unidades totales.' : 'Admite decimales con coma o punto.')}</p>
          {amount !== null && !error && product && <div className="transfer-preview"><span>Después del {action}</span><strong>{origin === 'Auxiliar' ? 'Auxiliar: 0' : `${origin}: ${formatStock(product, roundQty(from - amount))}`}<Icon name="arrow" size={16} />{destination === 'Auxiliar' ? 'Auxiliar: 0' : `${destination}: ${formatStock(product, roundQty(to + amount))}`}</strong></div>}
          <button className="button primary full" type="submit" disabled={!product || amount === null || Boolean(error)}><Icon name={busy ? 'check' : 'transfer'} />{busy ? 'Guardando…' : `Confirmar ${action}`}</button>
        </div>
      </fieldset>
    </form>
    <aside className="side-stack">
      <section className="card stock-card"><div className="card-heading"><span className="eyebrow">EXISTENCIAS ACTUALES</span><span className="live-dot" /></div><h2>{product?.nombre || 'Selecciona un producto'}</h2><p className="muted">Todas las zonas</p><div className="stock-list">{REAL_ZONES.map(zone => <div key={zone} className={zone === origin || zone === destination ? 'highlight' : ''}><span><i />{ZONE_LABELS[zone]}{(zone === origin || zone === destination) && <small>{zone === origin ? 'Origen' : 'Destino'}</small>}</span><strong>{formatStock(product, product ? getStock(inventory, product.nombre, zone) : 0)}</strong></div>)}</div><div className="stock-total"><span>Total del producto</span><strong>{formatStock(product, product ? roundQty(REAL_ZONES.reduce((sum, zone) => sum + getStock(inventory, product.nombre, zone), 0)) : 0)}</strong></div></section>
      <section className="note-card"><Icon name="info" /><div><h3>¿Para qué sirve Auxiliar?</h3><p>Como origen, introduce existencias. Como destino, las retira. Siempre queda a cero y no aparece en el global.</p></div></section>
    </aside>
  </div>;
}
