import { CATEGORIES } from '../domain/inventory.js';
import Icon from './Icon.jsx';
const icons = { Alcohol: 'bottle', Refrescos: 'cup', Menaje: 'layers' };
export function Categories({ value, onChange, all = false }) {
  return <div className="category-tabs" aria-label="Categoría">{[...(all ? ['Todas'] : []), ...CATEGORIES].map(cat => <button type="button" key={cat} onClick={() => onChange(cat)} aria-pressed={value === cat} className={value === cat ? 'selected' : ''}><Icon name={icons[cat] || 'grid'} size={18} />{cat}</button>)}</div>;
}
export function ProductPicker({ products, selected, onChange, label = 'Producto' }) {
  const groups = products.reduce((groups, p) => { const letter = p.nombre[0]?.toUpperCase() || '#'; (groups[letter] ||= []).push(p); return groups; }, {});
  return <label className="field"><span>{label}</span><select value={selected?.id || ''} onChange={event => onChange(event.target.value)} required><option value="" disabled>Selecciona un producto</option>{Object.entries(groups).map(([letter, items]) => <optgroup label={letter} key={letter}>{items.map(p => <option value={p.id} key={p.id}>{p.nombre}</option>)}</optgroup>)}</select></label>;
}
export function Search({ value, onChange, label = 'Buscar producto' }) {
  return <label className="search"><Icon name="search" /><input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder="Buscar producto…" aria-label={label} /></label>;
}
export function Empty({ title, children }) {
  return <div className="empty"><span className="empty-icon"><Icon name="box" size={28} /></span><h3>{title}</h3><p>{children}</p></div>;
}
