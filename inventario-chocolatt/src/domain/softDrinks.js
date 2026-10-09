import { formatQty, quantity, roundQty } from './inventory.js';
export const UNITS_PER_BOX = 24;
export const isSoftDrink = product => product?.categoria === 'Refrescos';
export function splitBoxes(total) {
  const boxes = Math.floor(total / UNITS_PER_BOX);
  return { boxes, loose: roundQty(total - boxes * UNITS_PER_BOX) };
}
export function productQuantity(input, product, allowZero = true) {
  let value = input;
  if (isSoftDrink(product) && typeof input === 'object' && input !== null) {
    const { boxes = '', loose = '' } = input;
    if (!String(boxes).trim() && !String(loose).trim()) throw new Error('Introduce cajas o unidades sueltas.');
    if (![boxes, loose].every(part => /^\d*$/.test(String(part)))) throw new Error('Introduce cajas y sueltos enteros, sin decimales.');
    value = Number(boxes || 0) * UNITS_PER_BOX + Number(loose || 0);
  }
  const result = quantity(value, allowZero);
  if (isSoftDrink(product) && !Number.isInteger(result)) throw new Error('Los refrescos se cuentan en unidades enteras.');
  return result;
}
export function tryProductQuantity(input, product, allowZero = true) {
  try { return productQuantity(input, product, allowZero); } catch { return null; }
}
export function formatStock(product, total) {
  if (!isSoftDrink(product)) return formatQty(total);
  const { boxes, loose } = splitBoxes(total);
  return `${formatQty(boxes)}-${formatQty(loose)} = ${formatQty(total)}`;
}
// Export-only convention; signed values (adjusted opening balance) retain their sign.
export function excelQuantity(product, total) {
  if (!isSoftDrink(product)) return total;
  const { boxes, loose } = splitBoxes(Math.abs(total));
  return Math.sign(total) * (boxes + (loose <= 8 ? 0 : loose <= 16 ? .5 : 1));
}
