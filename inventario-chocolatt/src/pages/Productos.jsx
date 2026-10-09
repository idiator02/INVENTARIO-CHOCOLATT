import { useRememberedSelection } from '../hooks/useRememberedSelection.js';
import { useState } from 'react';
import { CATEGORIES } from '../domain/inventory.js';
import { Empty } from '../components/Fields.jsx';
import ProductSelector from '../components/ProductSelector.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
export default function Productos({ products, inventory, repository, canWrite, busy, run, exportInventory }) {
  const [name, setName] = useState(''), [category, setCategory] = useRememberedSelection('Productos.category', 'Alcohol'), [selectedId, setSelectedId] = useRememberedSelection('Productos.product', '');
  const [confirmation, setConfirmation] = useState(null), [confirmText, setConfirmText] = useState('');
  const filtered = products.filter(p => !selectedId || p.id === selectedId);
  const close = () => { setConfirmation(null); setConfirmText(''); };
  async function add(event) {
    event.preventDefault();
    if (await run(() => repository.addProduct(name, category), 'Producto añadido al catálogo.')) setName('');
  }
  async function confirm() {
    const ok = await run(() => confirmation.type === 'delete' ? repository.deleteProduct(confirmation.product) : repository.resetInventory(confirmation.inventory), confirmation.type === 'delete' ? 'Producto eliminado.' : 'Las existencias seleccionadas se han puesto a cero.');
    if (ok) { if (confirmation.type === 'delete') setSelectedId(''); close(); }
  }
  return <div className="workspace-grid catalog-layout">
    <section className="card catalog-list"><div className="toolbar"><ProductSelector products={products} selected={products.find(p => p.id === selectedId)} onChange={setSelectedId} allowAll /><span className="badge">{products.length} productos</span></div><div className="catalog-groups">{CATEGORIES.map(cat => { const items = filtered.filter(p => p.categoria === cat); return items.length > 0 && <div key={cat}><h2 className="group-title">{cat}<span>{items.length}</span></h2>{items.map(p => <div className="catalog-row" key={p.id}><span>{p.nombre}</span><button className="icon-button subtle-danger" aria-label={`Eliminar ${p.nombre}`} disabled={!canWrite || busy} onClick={() => setConfirmation({ type: 'delete', product: p })}><Icon name="trash" size={18} /></button></div>)}</div>; })}{!filtered.length && <Empty title={products.length ? 'Sin resultados' : 'Tu catálogo está vacío'}>{products.length ? 'Prueba a buscar otro nombre.' : 'Añade un producto o carga el catálogo inicial de Chocolatt.'}</Empty>}</div></section>
    <aside className="side-stack"><form className="card card-body" onSubmit={add}><h2>Nuevo producto</h2><p className="muted">Disponible en todas las zonas.</p><fieldset className="form-stack" disabled={!canWrite || busy}><label className="field"><span>Nombre del producto</span><input value={name} onChange={event => setName(event.target.value)} maxLength="80" placeholder="Ej. Beefeater" required autoComplete="off" /></label><label className="field"><span>Categoría del producto</span><select value={category} onChange={event => setCategory(event.target.value)}>{CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}</select></label><button className="button primary full" disabled={!name.trim()}><Icon name="plus" />{busy ? 'Guardando…' : 'Añadir producto'}</button></fieldset></form>
    {!products.length && <button className="button secondary" disabled={!canWrite || busy} onClick={() => run(() => repository.seedCatalog(), 'Catálogo inicial cargado.')}>Cargar catálogo inicial</button>}
    <details className="danger-zone"><summary>Mantenimiento del inventario</summary><p>Pone a cero las existencias cargadas y elimina sus recuentos. Descarga una copia antes de continuar.</p><button className="button secondary full" onClick={exportInventory} disabled={busy || !products.length}><Icon name="download" />Descargar inventario</button><button className="button danger-outline full" disabled={!canWrite || busy || !Object.keys(inventory).length} onClick={() => setConfirmation({ type: 'reset', inventory })}>Poner existencias a cero</button></details></aside>
    {confirmation && <Modal title={confirmation.type === 'delete' ? 'Eliminar producto' : 'Poner existencias a cero'} busy={busy} onClose={close}>{confirmation.type === 'delete' ? <p>¿Eliminar <strong>{confirmation.product.nombre}</strong>? Solo es posible si no tiene existencias ni recuentos pendientes.</p> : <><p>Se pondrán a cero las existencias cargadas de todas las zonas. También se eliminarán sus recuentos pendientes. Esta operación no se puede deshacer desde la app.</p><label className="field"><span>Escribe BORRAR para confirmar</span><input value={confirmText} onChange={event => setConfirmText(event.target.value)} autoComplete="off" disabled={busy} /></label></>}<div className="modal-actions"><button className="button secondary" onClick={close} disabled={busy}>Cancelar</button><button className="button danger" onClick={confirm} disabled={!canWrite || busy || (confirmation.type === 'reset' && confirmText !== 'BORRAR')}>{busy ? 'Guardando…' : 'Confirmar'}</button></div></Modal>}
  </div>;
}
