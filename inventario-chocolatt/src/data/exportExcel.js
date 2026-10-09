import { excelQuantity } from '../domain/softDrinks.js';
import { ZONE_LABELS } from '../domain/inventory.js';
import { countRows, inventoryRows } from '../domain/exportRows.js';
function dateLabel() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
async function download(rows, sheet, name, numberFormat) {
  // Export-only library, loaded on demand. Leading '=' remains literal text.
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const columns = rows[0].map((_, index) => ({ width: Math.min(42, Math.max(14, ...rows.map(row => String(row[index] ?? '').length)) + 2) }));
  const data = rows.map((row, rowIndex) => row.map(value => ({
    value, type: typeof value === 'number' ? Number : String,
    ...(typeof value === 'number' ? { format: numberFormat } : {}),
    ...(rowIndex === 0 ? { fontWeight: 'bold', backgroundColor: '#223137', textColor: '#FFFFFF', height: 27 } : { height: 21 }),
  })));
  await writeExcelFile(data, { sheet, columns, stickyRowsCount: 1 }).toFile(`${name}_${dateLabel()}.xlsx`);
}
export const exportInventory = (products, inventory) => download(inventoryRows(products, inventory), 'Inventario', 'Inventario_Chocolatt', '0.0#');
export const exportCounts = counts => download(countRows(counts), 'Consumo', 'Consumo_Chocolatt', '0.0#');

export async function exportTransfers(transfers) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const rows = [['Barra', 'Producto', 'Cantidad', 'Firma'], ...transfers.map(t => [ZONE_LABELS[t.destination], t.producto, excelQuantity(t, t.amount), ''])];
  const data = rows.map((row, index) => row.map(value => ({ value, type: typeof value === 'number' ? Number : String, ...(typeof value === 'number' ? { format: '0.0#' } : {}), height: index ? 66 : 27, ...(index ? { alignVertical: 'center' } : { fontWeight: 'bold', backgroundColor: '#223137', textColor: '#FFFFFF' }) })));
  const images = transfers.map((t, index) => ({
    content: Uint8Array.from(atob(t.signature.split(',')[1]), char => char.charCodeAt(0)).buffer,
    contentType: 'image/png', width: 192, height: 66, dpi: 96, anchor: { row: index + 2, column: 4 }, title: `Firma ${t.producto}`,
  }));
  await writeExcelFile(data, { sheet: 'Traslados', columns: [{width:22},{width:30},{width:16},{width:30}], stickyRowsCount:1, images }).toFile(`Traslados_${dateLabel()}.xlsx`);
}
