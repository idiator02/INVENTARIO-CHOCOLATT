import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { activeCounts, CATEGORIES, normalizeName, tryQuantity, userError } from './domain/inventory.js';
import { useInventory, DEMO } from './hooks/useInventory.js';
import { usePwa } from './hooks/usePwa.js';
import { exportCounts, exportInventory } from './data/exportExcel.js';
import Icon from './components/Icon.jsx';
import Modal from './components/Modal.jsx';
import Traspasos from './pages/Traspasos.jsx';
import Consumo from './pages/Consumo.jsx';
import Global from './pages/Global.jsx';
import Productos from './pages/Productos.jsx';
import Recuento from './pages/Recuento.jsx';
const pages = {
  traspasos: { title: 'Traspasos', icon: 'transfer', description: 'Mueve existencias entre tus zonas.' },
  consumo: { title: 'Consumo', icon: 'cup', description: 'Registra rápidamente lo que llevas a las barras.' },
  global: { title: 'Global', icon: 'grid', description: 'Todas las existencias, en un solo vistazo.' },
  fin: { title: 'Recuento', icon: 'check', description: 'Cuenta lo que queda y calcula el consumo de cada barra.' },
  productos: { title: 'Productos', icon: 'box', description: 'Organiza el catálogo de alcohol, refrescos y menaje.' },
};
const currentPage = () => Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'traspasos';
export default function App() {
  const data = useInventory(), pwa = usePwa();
  const [page, setPage] = useState(currentPage), [busy, setBusy] = useState(false), [notice, setNotice] = useState(null), [modal, setModal] = useState(null);
  const lock = useRef(false);
  useEffect(() => {
    const change = () => setPage(currentPage());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!notice || notice.type === 'error') return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    document.documentElement.dataset.activePage = page;
    return () => { delete document.documentElement.dataset.activePage; };
  }, [page]);
  const invalid = Object.entries(data.inventory).filter(([, record]) => record.cantidad != null && tryQuantity(record.cantidad) === null);
  const invalidProducts = data.products.filter(p => typeof p.nombre !== 'string' || !p.nombre || !CATEGORIES.includes(p.categoria));
  const duplicates = data.products.filter((p, i, all) => typeof p.nombre === 'string' && all.findIndex(q => typeof q.nombre === 'string' && normalizeName(q.nombre) === normalizeName(p.nombre)) !== i);
  const integrityError = invalid.length > 0 || invalidProducts.length > 0;
  const counts = integrityError ? [] : activeCounts(data.inventory);
  const canWrite = data.canWrite && !integrityError;
  async function run(action, message, requireConnection = true) {
    if (lock.current) return false;
    if (requireConnection && !canWrite) { setNotice({ type: 'error', text: 'Espera a que se confirme la conexión antes de guardar.' }); return false; }
    lock.current = true; setBusy(true); setNotice(null);
    try { await action(); if (message) setNotice({ type: 'success', text: message }); return true; }
    catch (error) { setNotice({ type: 'error', text: userError(error) }); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  const downloadInventory = () => run(() => exportInventory(data.products, data.inventory), 'Inventario preparado para descargar.', false);
  const downloadCounts = () => run(() => exportCounts(counts), 'Consumo preparado para descargar.', false);
  const shared = { ...data, canWrite, busy, run, counts, exportInventory: downloadInventory, exportCounts: downloadCounts };
  const status = DEMO ? 'Demostración' : !data.online ? 'Sin conexión' : data.error ? 'Error de conexión' : data.synced ? 'Sincronizado' : 'Conectando…';
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    {DEMO && <div className="demo-banner">MODO DEMOSTRACIÓN · Datos ficticios guardados solo en este navegador</div>}
    <header className="app-header"><div className="header-inner"><a href="#traspasos" className="brand" aria-label="Chocolatt, inicio"><span className="brand-mark">C<span /></span><span><strong>CHOCOLATT</strong><small>CONTROL DE INVENTARIO</small></span></a><div className="header-actions"><span className={`connection ${data.synced && data.online ? 'connected' : ''}`} role="status"><i />{status}</span>{!pwa.installed && <button className="install-button" onClick={() => pwa.canPrompt ? pwa.install() : setModal('install')} aria-label="Instalar aplicación"><Icon name="download" size={18} /><span>Instalar app</span></button>}</div></div></header>
    <main className="main" id="main-content"><div className="page-heading"><div><span className="eyebrow">TU ESPACIO DE TRABAJO</span><h1>{pages[page].title}<span className="title-dot">.</span></h1><p>{pages[page].description}</p></div><span className="workspace-badge"><Icon name="layers" size={17} />4 zonas</span></div>
    {pwa.hasUpdate && <div className="notice info"><span>Hay una nueva versión disponible.</span><button className="text-button" onClick={() => setModal('update')} disabled={busy}>Actualizar app</button></div>}
    {!data.online && <div className="notice warning"><Icon name="wifi" /><span>Sin conexión. Puedes consultar los datos guardados en este dispositivo; los cambios requieren conexión.</span></div>}
    {data.error && <div className="notice error" role="alert"><span>{userError(data.error)}</span><button className="text-button" onClick={() => location.reload()} disabled={busy}>Reintentar conexión</button></div>}
    {data.loaded && !data.synced && data.online && !data.error && <div className="notice warning">Esperando confirmación de Firebase. Las existencias mostradas pueden ser de una consulta anterior.</div>}
    {duplicates.length > 0 && <div className="notice warning">Hay nombres duplicados en el catálogo original: {duplicates.map(p => p.nombre).join(', ')}. Revisa estos productos para evitar confusiones y recuentos repetidos.</div>}
    {integrityError ? <div className="notice error" role="alert">Hay datos que requieren revisión en Firebase: {invalid.map(([key]) => key).concat(invalidProducts.map(p => `producto ${p.id}`)).join(', ')}. Se han bloqueado las operaciones para conservarlos.</div> : !data.loaded ? <section className="card loading" aria-live="polite"><span className="spinner" /><h2>{data.error ? 'No se han podido cargar tus datos' : 'Cargando tu inventario…'}</h2><p>La conexión se confirma antes de guardar cambios.</p></section> : <>
      {!data.products.length && page !== 'productos' && <div className="notice info">El catálogo está vacío. <a href="#productos">Añadir productos</a></div>}
      {page === 'traspasos' && <Traspasos {...shared} />}
      {page === 'consumo' && <Consumo {...shared} />}
      {page === 'global' && <Global {...shared} />}
      {page === 'fin' && <Recuento {...shared} />}
      {page === 'productos' && <Productos {...shared} />}
    </>}
    </main>
    {notice && createPortal(<div className={`toast ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><Icon name={notice.type === 'error' ? 'info' : 'check'} /><span>{notice.text}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => setNotice(null)}><Icon name="close" size={17} /></button></div>, notice.type === 'error' ? document.querySelector('dialog[open]') || document.body : document.body)}
    <nav className="bottom-nav" aria-label="Navegación principal"><div>{Object.entries(pages).map(([key, item]) => <a key={key} href={`#${key}`} aria-current={page === key ? 'page' : undefined}><Icon name={item.icon} size={21} /><span>{item.title}</span>{key === 'fin' && counts.length > 0 && <i className="nav-count">{counts.length}</i>}</a>)}</div></nav>
    {modal === 'install' && <Modal title="Instalar Chocolatt" onClose={() => setModal(null)}><p>Abre la app desde su dirección HTTPS para añadirla a tu móvil o escritorio.</p><ul className="install-list"><li><strong>iPhone o iPad:</strong> en Safari, pulsa Compartir → Añadir a pantalla de inicio.</li><li><strong>Android:</strong> en Chrome, abre el menú → Instalar aplicación o Añadir a pantalla de inicio.</li><li><strong>Ordenador:</strong> en Chrome o Edge, usa el icono de instalación de la barra de direcciones o la opción del menú.</li></ul><p className="hint">Las opciones dependen del navegador. Si ya está instalada, ábrela desde su icono.</p></Modal>}
    {modal === 'update' && <Modal title="Actualizar aplicación" busy={busy} onClose={() => setModal(null)}><p>La página se recargará. Guarda antes cualquier cantidad que estés escribiendo.</p><div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Ahora no</button><button className="button primary" disabled={busy} onClick={pwa.update}>Actualizar</button></div></Modal>}
  </div>;
}
