import { useId, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { searchText } from '../domain/inventory.js';
import Icon from './Icon.jsx';

export default function SearchableProductPicker({ products, selected, onChange, disabled = false, favorites = [], onToggleFavorite, favoriteError, allowAll = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const trigger = useRef(null), dialog = useRef(null), search = useRef(null);
  const id = useId();
  const matching = products.filter(p => searchText(p.nombre).includes(searchText(query.trim())));
  const items = onToggleFavorite ? [...matching].sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || a.nombre.localeCompare(b.nombre, 'es')) : matching;
  function position() {
    const el = dialog.current, anchor = trigger.current;
    if (!el || !anchor) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const offset = viewport?.offsetTop ?? 0;
    const rect = anchor.getBoundingClientRect();
    const menuWidth = Math.min(Math.max(rect.width, 280), width - 24);
    const top = Math.max(offset + 12, Math.min(rect.bottom + 6, offset + height - Math.min(380, height - 24)));
    Object.assign(el.style, { width: `${menuWidth}px`, left: `${Math.max(12, Math.min(rect.left, width - menuWidth - 12))}px`, top: `${top}px`, maxHeight: `${Math.max(120, offset + height - top - 12)}px` });
  }
  function close() { dialog.current?.close(); }
  function show() {
    setQuery('');
    position();
    dialog.current.showModal();
    setOpen(true);
    search.current.focus();
  }
  useEffect(() => {
    const viewport = window.visualViewport;
    window.addEventListener('resize', position);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    return () => { window.removeEventListener('resize', position); viewport?.removeEventListener('resize', position); viewport?.removeEventListener('scroll', position); };
  }, []);
  useEffect(() => { if (disabled) dialog.current?.close(); }, [disabled]);
  return <div className="field">
    <span id={`${id}-label`}>Producto</span>
    <button ref={trigger} type="button" className="product-picker-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} disabled={disabled || !products.length} onClick={show}>
      <span id={`${id}-value`}>{selected?.nombre || (allowAll ? 'Todos los productos' : 'Selecciona un producto')}</span><span aria-hidden="true">⌄</span>
    </button>
    {createPortal(<dialog ref={dialog} id={id} className="product-dropdown" aria-label="Seleccionar producto" onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } }}>
      <div className="product-dropdown-search"><Icon name="search" /><input ref={search} type="search" aria-label="Buscar producto" placeholder="Buscar producto…" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); dialog.current.querySelector('.product-choice')?.focus(); } }} /><button type="button" className="icon-button" aria-label="Cerrar selector" onClick={close}><Icon name="close" /></button></div>
      {favoriteError && <p className="inline-error picker-error" role="alert">{favoriteError}</p>}
      <div className="product-dropdown-list" aria-label="Productos disponibles" onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        const choices = [...dialog.current.querySelectorAll('.product-choice')];
        const index = choices.indexOf(document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        choices[(index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus();
      }}>
        {allowAll && <div className="product-dropdown-row"><button type="button" className="product-choice" aria-pressed={!selected} onClick={() => { onChange(''); close(); }}>Todos los productos</button></div>}
        {items.map(p => <div className="product-dropdown-row" key={p.id}>
          <button type="button" className="product-choice" aria-pressed={selected?.id === p.id} disabled={disabled} onClick={() => { onChange(p.id); close(); }}>{p.nombre}{selected?.id === p.id && <span aria-hidden="true">✓</span>}</button>
          {onToggleFavorite && <button type="button" className="product-favorite" aria-label={`${favorites.includes(p.id) ? 'Quitar de favoritos' : 'Marcar favorito'}: ${p.nombre}`} aria-pressed={favorites.includes(p.id)} onClick={() => onToggleFavorite(p.id)}>{favorites.includes(p.id) ? '★' : '☆'}</button>}
        </div>)}
        {!items.length && <p className="picker-empty" role="status">No hay productos que coincidan.</p>}
      </div>
    </dialog>, document.body)}
  </div>;
}
