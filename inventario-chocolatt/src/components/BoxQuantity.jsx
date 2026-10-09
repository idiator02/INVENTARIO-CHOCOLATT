import { formatQty, tryQuantity } from '../domain/inventory.js';
import { splitBoxes, tryProductQuantity } from '../domain/softDrinks.js';
export default function BoxQuantity({ value, onChange, label = 'Cantidad a mover' }) {
  const parts = value && typeof value === 'object' ? value : value === '' ? { boxes: '', loose: '' } : splitBoxes(tryQuantity(value) ?? 0);
  const amount = tryProductQuantity(parts, { categoria: 'Refrescos' });
  return <div className="box-quantity" role="group" aria-label={label}>
    <div className="box-quantity-fields">
      <label className="field"><span>Cajas (24 uds.)</span><input type="text" inputMode="numeric" autoComplete="off" placeholder="0" value={parts.boxes} onChange={event => onChange({ ...parts, boxes: event.target.value })} /></label>
      <label className="field"><span>Sueltos</span><input type="text" inputMode="numeric" autoComplete="off" placeholder="0" value={parts.loose} onChange={event => onChange({ ...parts, loose: event.target.value })} /></label>
    </div>
    <p className="hint">{amount === null ? '1 caja = 24 unidades. Introduce cajas o sueltos.' : `Total: ${formatQty(amount)} unidades`}</p>
  </div>;
}
