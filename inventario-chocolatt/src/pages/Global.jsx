import { useRememberedSelection } from '../hooks/useRememberedSelection.js';
import { useState } from 'react';
import { CATEGORIES, REAL_ZONES, ZONE_LABELS, getStock, roundQty } from '../domain/inventory.js';
import { Empty } from '../components/Fields.jsx';
import ProductSelector from '../components/ProductSelector.jsx';
import { formatStock } from '../domain/softDrinks.js';
import Icon from '../components/Icon.jsx';
export default function Global({ products, inventory, exportInventory, busy }) {
  const [selectedId, setSelectedId] = useRememberedSelection('Global.product', ''), [onlyEmpty, setOnlyEmpty] = useState(false);
  const total = product => roundQty(REAL_ZONES.reduce((sum, zone) => sum + getStock(inventory, product.nombre, zone), 0));
  const filtered = products.filter(p => (!selectedId || p.id === selectedId) && (!onlyEmpty || total(p) === 0));
  return <div className="stack">
    <div className="stats-grid">{CATEGORIES.map((cat, i) => <div className="stat-card" key={cat}><span className={`stat-icon tone-${i}`}><Icon name={['bottle', 'cup', 'layers'][i]} size={23} /></span><div><span>{cat}</span><strong>{products.filter(p => p.categoria === cat).length}<small>productos</small></strong></div></div>)}</div>
    <section className="card">
      <div className="toolbar"><ProductSelector products={products} selected={products.find(p => p.id === selectedId)} onChange={setSelectedId} allowAll /><button className="button secondary" onClick={exportInventory} disabled={busy || !products.length}><Icon name="download" />Exportar Excel</button></div>
      <div className="filter-row"><label className="checkbox"><input type="checkbox" checked={onlyEmpty} onChange={event => setOnlyEmpty(event.target.checked)} />Sin existencias</label></div>
      {filtered.length ? <><div className="table-scroll" role="region" aria-label="Inventario por zonas; desplaza horizontalmente para ver todas" tabIndex="0"><table><caption className="sr-only">Existencias en las cuatro zonas reales</caption><thead><tr><th scope="col">Producto</th>{REAL_ZONES.map(z => <th key={z} scope="col">{ZONE_LABELS[z]}</th>)}<th scope="col" className="total-cell">Total</th></tr></thead>{CATEGORIES.map(cat => { const items = filtered.filter(p => p.categoria === cat); return items.length > 0 && <tbody key={cat}><tr className="category-row"><th scope="rowgroup" colSpan="6">{cat}<small>{items.length}</small></th></tr>{items.map(p => <tr key={p.id}><th scope="row">{p.nombre}</th>{REAL_ZONES.map(z => { const value = getStock(inventory, p.nombre, z); return <td key={z} className={value === 0 ? 'zero-cell' : ''}>{formatStock(p, value)}</td>; })}<td className="total-cell">{formatStock(p, total(p))}</td></tr>)}</tbody>; })}</table></div><div className="table-footer"><span>{filtered.length} de {products.length} productos</span><span>Desliza para ver todas las zonas <Icon name="arrow" size={14} /></span></div></> : <Empty title="No hay productos que coincidan">Prueba con otro nombre o cambia los filtros.</Empty>}
    </section>
  </div>;
}
