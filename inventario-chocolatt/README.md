# Chocolatt · Inventario 1.1

Aplicación web adaptable a móvil y escritorio, con instalación como PWA y Firebase Firestore. Conserva las colecciones y los nombres de documentos del proyecto original.

## Probar primero con datos ficticios

Requiere Node.js 22.12 o posterior (recomendado: 24 LTS).

```bash
npm ci
npm run dev:demo
```

Abre la dirección que muestre Vite. La franja «MODO DEMOSTRACIÓN» confirma que los cambios se guardan solo en ese navegador. Este modo no inicializa Firebase. Para reiniciar la demo, borra los datos del sitio en el navegador. La demo no sincroniza pestañas ni dispositivos.

## Usar la conexión original con Firebase

El `.env` original se conserva en esta entrega; no se ha consultado ni modificado la base de datos durante la revisión. No publiques ese archivo en un repositorio. Si necesitas otra configuración, copia `.env.example` a `.env` y completa sus valores.

```bash
npm run dev
```

Este comando abre la versión que conecta con tu Firebase. Los botones que guardan, borran o ponen a cero actúan sobre esa base de datos. Abrir la página no crea ni modifica datos automáticamente.

Antes de sustituir la versión que usáis, revisa los permisos indicados en `docs/REVISION.md` y cierra las pestañas de la app antigua en todos los dispositivos. No mezcles las dos versiones durante el trabajo.

## Generar la versión instalable

```bash
npm run build
npm run preview
```

`dist/` contiene la versión de producción ya compilada, incluidos manifiesto, iconos y service worker. Publica su contenido completo en el alojamiento web que utilices. Para instalarla necesita HTTPS; `localhost` sirve para probarla. Los enlaces y los recursos permiten alojarla en una subcarpeta. No se ha publicado esta entrega.

- Android / Chrome: botón «Instalar app» cuando el navegador lo ofrezca, o menú del navegador.
- iPhone / Safari: Compartir → Añadir a pantalla de inicio.
- Escritorio / Chrome o Edge: icono de instalación en la barra de direcciones, si está disponible.
- Al detectar una actualización aparece un aviso. La recarga se hace cuando la aceptas.

Para probar instalación y modo sin conexión con datos ficticios:

```bash
npm run build:demo
npm run preview:demo
```

`dist-demo/` también se incluye y se diferencia por su aviso permanente de demostración. No lo publiques como inventario real.

## Funcionamiento

| Pantalla | Función |
| --- | --- |
| Traspasos | Seleccionar categoría, producto, origen, destino y cantidad. Muestra stock actual y resultado previsto. |
| Global | Consultar las cuatro zonas reales, buscar productos, filtrar categorías o productos sin existencias y descargar Excel. |
| Recuento | Guardar lo que queda en Barra Medio o Barra Chica, calcular consumo, corregir o deshacer y exportar. |
| Productos | Añadir productos únicos, eliminar solo cuando estén a cero y sin recuentos, y acceder al mantenimiento. |

Auxiliar sirve exclusivamente para entradas o salidas externas. No acumula stock, no se escribe en Firestore y no aparece en el global. Los traspasos entre zonas reales conservan el total. Se admiten cantidades con coma o punto, hasta dos decimales; el cero es válido en un recuento.

El recuento guarda juntos stock físico, teórico y consumo en Firebase. Puede recuperarse al volver a abrir la aplicación. Corregirlo conserva el teórico original. Si hay movimientos posteriores, no se permite corregirlo ni deshacerlo: descarga su consumo y vacía la lista antes de iniciar otro. Vaciar la lista conserva las existencias; elimina esos recuentos para todos los dispositivos. No es un histórico por noches.

Sin conexión se puede consultar la última copia disponible en el dispositivo, si existe. Los cambios necesitan conexión y confirmación del servidor. La app no pone escrituras de stock en cola sin conexión. La instalación y la persistencia local dependen de las capacidades y el almacenamiento del navegador.

## Verificación y estructura

```bash
npm run check
```

Ejecuta ESLint, pruebas de regresión y compilación de producción. `tests/inventory.test.js` comprueba las operaciones con un almacén de prueba que simula conflictos y reintentos; no utiliza el Firebase real.

- `src/domain/`: reglas, validación, cantidades y filas de exportación.
- `src/data/operations.js`: operaciones atómicas compartidas por Firebase y demo.
- `src/data/firebaseRepository.js`: escucha y transacciones de Firestore.
- `src/pages/`: las cuatro pantallas.
- `src/hooks/`: conexión e instalación/actualización.
- `scripts/generate-sw.mjs`: caché de los archivos exactos de cada compilación.
- `docs/REVISION.md`: cambios, límites y propuestas pendientes.
- `docs/capturas/`: vistas de la demo revisada.

No se incluyen `node_modules`: `npm ci` instala las dependencias apropiadas para tu ordenador a partir del archivo de bloqueo.
