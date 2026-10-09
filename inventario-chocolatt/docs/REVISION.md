# Revisión del inventario Chocolatt

## Lógica conservada

Catálogo agrupado en Alcohol, Refrescos y Menaje. Cuatro zonas reales: B.Chocolatt, B.Medio, B.Chica y Almacén. Auxiliar es exclusivamente un origen o destino externo, siempre a cero. El consumo se obtiene del recuento en B.Medio y B.Chica: teórico menos físico. Guardar el recuento actualiza inmediatamente las existencias globales al valor físico.

## Problemas corregidos

| En el proyecto recibido | En esta versión |
| --- | --- |
| Al mover más stock del disponible se dejaba el origen a cero y se añadía toda la cantidad al destino. | Se rechaza el movimiento completo; no se crean unidades inexistentes. |
| Dos dispositivos calculaban saldos a partir de su copia y podían sobrescribir el movimiento del otro. | Se leen y escriben origen y destino mediante una transacción de Firestore. |
| `parseFloat` aceptaba textos parcialmente numéricos y cantidades negativas. | Validación completa, decimales con coma/punto y límite de dos decimales. |
| El recuento vivía solo en memoria aunque ya había actualizado Firebase. | Recuento y stock se guardan atómicamente en el mismo documento. |
| Se actualizaba la pantalla como si el recuento hubiera funcionado antes de confirmar la escritura. | Se espera confirmación y se muestra el fallo si no se completa. |
| Deshacer un recuento podía sobrescribir movimientos posteriores. | Se comprueban revisión y cantidad antes de restaurar el teórico. |
| Los nombres con guion se cortaban al exportar o mostrar recuentos. | La zona se reconoce por su sufijo completo. |
| Se permitían duplicados y borrar productos con existencias. | Se comprueban duplicados, cantidades y recuentos antes de las operaciones. |
| Los errores apenas aparecían en la consola. | Avisos visibles de error, conexión, stock insuficiente y datos modificados. |
| La app creaba el catálogo al abrirla si estaba vacío. | La carga inicial requiere pulsar un botón; abrir la app solo lee. |
| «Excel» era una tabla HTML con extensión `.xls`. | Archivos `.xlsx` reales, con celdas numéricas, nombres como texto y cabecera fija. |
| La librería `xlsx` 0.18.5 tenía avisos en la auditoría de dependencias. | Sustituida por `write-excel-file`, dedicada a exportar. |
| Faltaban manifiesto, iconos y service worker. | PWA preparada, recursos versionados, aviso de nueva versión y consulta sin conexión. |
| La tabla global ocultaba la navegación en horizontal. | Tabla desplazable, cabecera y producto fijos; navegación accesible en horizontal. |
| Reinicio sin protección frente a datos desactualizados. | Confirmación escrita y transacción que comprueba los registros seleccionados. |

Interfaz rediseñada manteniendo un tema oscuro adecuado para barras: menos saturación, botones táctiles, etiquetas accesibles, navegación inferior, filtros y vista previa del resultado del movimiento. Se ha separado la lógica de las pantallas y eliminado código de plantilla sin uso.

## Datos y compatibilidad

Se mantienen `productos/{id}` e `inventario/{nombre}-{zona}`. No se renombran productos existentes ni se migran documentos. Los nuevos productos usan un identificador determinista para evitar duplicados simultáneos. Los nombres se mantienen únicos entre categorías porque el inventario original se identifica por nombre y zona.

Las escrituras de inventario conservan los campos existentes y añaden:

- `revision`: identificador de cada cambio de existencias.
- `actualizadoEn`: fecha de servidor.
- `recuento`: nulo o un objeto con `id`, `revisionStock`, `producto`, `categoria`, `zona`, `teorico`, `fisico`, `consumo`, `diferencia` y `fecha`.

No se necesitan nuevas colecciones ni índices compuestos. **Si tus reglas de Firestore solo permiten el campo `cantidad`, necesitarán admitir también estos campos.** Los permisos de lectura, creación, actualización y borrado siguen dependiendo de tus reglas desplegadas.

La versión antigua no mantiene las revisiones ni los recuentos nuevos. Antes de usar esta entrega, exporta cualquier recuento abierto en la versión antigua y cierra sus pestañas en todos los dispositivos. Un recuento que ya se perdió al recargar la versión anterior no se puede reconstruir a partir de un stock físico aislado.

Si quedan documentos de antiguos productos eliminados, no se borran de forma automática. El global, como antes, se basa en el catálogo. Una limpieza de registros huérfanos debe hacerse después de identificar esos productos.

## Alcance de la verificación

ESLint sin errores ni avisos, 19 pruebas de lógica superadas y compilaciones de producción y demo correctas. Auditoría de dependencias de producción: 0 vulnerabilidades informadas. Las pruebas de navegador y sus límites se detallan en `PRUEBAS_NAVEGADOR.txt`. La compilación y las pruebas de reglas de inventario se realizan localmente. Las pruebas de navegador emplean exclusivamente el modo demo, con conexiones externas bloqueadas. No se ha leído ni alterado el inventario de Firebase, no se han cambiado sus reglas y no se ha publicado la aplicación.

No se incluye en el ZIP original un sistema de autenticación, reglas de Firestore ni configuración de alojamiento. Por tanto, no se puede confirmar quién tiene acceso a la base de datos ni si las reglas actuales permiten los campos añadidos. La validación en el cliente no sustituye las reglas de acceso del servidor.

El reinicio y el vaciado se limitan a 400 registros por operación para mantenerlos atómicos; si se supera ese tamaño, se rechazan sin cambios parciales. El reinicio comprueba los registros que estaban cargados al abrir su confirmación. Conviene hacerlo fuera del servicio: los productos/registros creados después de abrir esa confirmación quedan fuera de la selección. No es una herramienta de administración masiva.

La demo usa almacenamiento local; la concurrencia se comprueba en las pruebas de transacciones. Quedan pendientes una prueba con las reglas reales de Firebase y comprobar la instalación en vuestros teléfonos físicos y en el alojamiento definitivo.

## Propuestas para decidir contigo

1. **Acceso por usuario y permisos.** Identificar a cada persona y distinguir administrador de personal de barra. El personal podría traspasar y contar; el administrador gestionaría catálogo y reinicios. Requiere decidir quién entra y adaptar Firebase Authentication y las reglas.
2. **Histórico por noche o evento.** Abrir una sesión, asociar movimientos y recuentos, y cerrar conservando su consumo. Permitiría consultar noches anteriores sin depender de un Excel. Hay que decidir si Medio y Chica se cierran juntas o por separado.
3. **Registro de movimientos y correcciones.** Guardar quién movió qué, fecha, origen, destino y motivo de una entrada/salida por Auxiliar. Las correcciones deberían generar un movimiento compensatorio para dejar rastro.
4. **Mínimos y reposición.** Fijar un mínimo por producto y barra y obtener una lista de lo que falta desde almacén. No se han inventado mínimos ni se han sumado productos con unidades distintas.
5. **Unidades y formatos.** Definir si cada producto se cuenta por botellas, cajas, latas, paquetes o unidades, y sus conversiones. Evitaría confundir una caja de refrescos con una unidad.

Mi prioridad: decidir usuarios/permisos y después histórico por noche. Las reglas operativas actuales se han mantenido salvo los controles necesarios para evitar pérdidas o creación de stock.

## Referencias técnicas

- [Transacciones y escrituras atómicas de Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions).
- [Caché local y consulta sin conexión de Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
- [Reglas de seguridad de Firestore](https://firebase.google.com/docs/firestore/security/get-started).
- [Requisitos de instalación de una PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- [Generación de Excel con write-excel-file](https://github.com/catamphetamine/write-excel-file).
