export const CATEGORIES = ['Alcohol', 'Refrescos', 'Menaje'];
export const REAL_ZONES = ['B.Chocolatt', 'B.Medio', 'B.Chica', 'Almacén'];
export const CONSUMPTION_DESTINATIONS = ['B.Medio', 'B.Chica'];
export const COUNT_ZONES = ['B.Chocolatt', 'Almacén', 'B.Medio', 'B.Chica'];
export const ZONES = [...REAL_ZONES, 'Auxiliar'];
export const ZONE_LABELS = {
  'B.Chocolatt': 'Barra Chocolatt', 'B.Medio': 'Barra Medio',
  'B.Chica': 'Barra Chica', 'Almacén': 'Almacén', 'Auxiliar': 'Auxiliar',
};
export const DEFAULT_PRODUCTS = {
  Alcohol: ['Absolut', "Ballantine's", 'Barceló', 'Beefeater', 'Beefeater Pink', 'Belvedere', 'Black Label', 'Fireball', "Jack Daniel's", 'Jagger', 'Legendario', 'Lobo Amarillo', 'Lobo Rosa', 'Lobo Verde', 'Malavita', 'Moskovskaya', 'Red Label', 'Rives', "Seagram's"],
  Refrescos: ['Agua', 'Cola', 'Cola Zero', 'Limón', 'Monster', 'Monster Mango Loco', 'Naranja', 'Power', 'Power Morado', 'Power Rosa', 'Sprite', 'Tónica', 'Tónica Fresa'],
  Menaje: ['Bolsa Hielo (5ud)', 'Paquete Bolsas Basura', 'Paquete Pajitas', 'Paquete Servilletas', 'Trapo', 'Vasos Chupitos'],
};
const formatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
export const formatQty = value => formatter.format(value);
export const roundQty = value => Math.round((value + Number.EPSILON) * 100) / 100;
export const normalizeName = name => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
export const searchText = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
export const productId = name => `p_${encodeURIComponent(normalizeName(name))}`;
export function quantity(value, allowZero = true) {
  const text = String(value).trim();
  if (!/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(text)) throw new Error('Introduce una cantidad válida con un máximo de dos decimales.');
  const number = Number(text.replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > 1000000 || (!allowZero && number === 0)) {
    throw new Error(allowZero ? 'La cantidad debe estar entre 0 y 1.000.000.' : 'La cantidad debe ser mayor que cero y no superar 1.000.000.');
  }
  return roundQty(number);
}
export function tryQuantity(text, allowZero = true) { try { return quantity(text, allowZero); } catch { return null; } }
export function validProductName(value) {
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80 || /[/\\\p{Cc}]/u.test(name)) throw new Error('Usa un nombre de 1 a 80 caracteres, sin barras ni caracteres de control.');
  return name;
}
// Preserve existing IDs, including product names containing hyphens.
export const stockKey = (name, zone) => `${name}-${zone}`;
export function parseStockKey(key) {
  const zone = ZONES.find(z => key.endsWith(`-${z}`));
  return zone ? { producto: key.slice(0, -zone.length - 1), zona: zone } : null;
}
export function stock(record) {
  if (record == null || record.cantidad == null) return 0;
  return quantity(record.cantidad);
}
export const getStock = (inventory, name, zone) => zone === 'Auxiliar' ? 0 : stock(inventory[stockKey(name, zone)]);
export function stockToken(record) { return JSON.stringify([record?.revision ?? null, record?.cantidad ?? 0, record?.recuento?.id ?? null]); }
// Existing counts are corrected at their original moment; later transfers do not stale the form.
export const countToken = record => record?.recuento ? JSON.stringify(['recuento', record.recuento.id]) : stockToken(record);
export function activeCounts(inventory) {
  return Object.entries(inventory).flatMap(([key, record]) => {
    const parsed = parseStockKey(key);
    if (!record.recuento || !parsed || !COUNT_ZONES.includes(parsed.zona)) return [];
    return [{ ...record.recuento, ...parsed, key, editable: true }];
  }).sort((a, b) => a.zona.localeCompare(b.zona, 'es') || a.producto.localeCompare(b.producto, 'es'));
}
export function userError(error) {
  const code = error?.code?.replace('firestore/', '');
  if (code === 'permission-denied') return 'Firebase ha rechazado el acceso. Revisa los permisos de Firestore; el cambio no se ha guardado.';
  if (['unavailable', 'deadline-exceeded'].includes(code)) return 'No se ha podido confirmar el cambio. Revisa la conexión y las existencias antes de intentarlo de nuevo.';
  if (code === 'unauthenticated') return 'Firebase requiere iniciar sesión. Es necesario configurar el acceso a esta aplicación.';
  if (code === 'aborted') return 'Otra persona ha actualizado estos datos. Revísalos e inténtalo de nuevo.';
  return error?.message || 'No se ha podido completar la operación.';
}
