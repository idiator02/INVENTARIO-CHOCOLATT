import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
// Explicit values take priority over .env and shell settings. Never inherit production.
const env = {
  VITE_DEMO_MODE: 'false',
  VITE_FIREBASE_API_KEY: 'AIzaSyAFn4hfYW--LWUGNdpZ_aC0KtftHOJeaYQ',
  VITE_FIREBASE_AUTH_DOMAIN: 'prechocolatt.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'prechocolatt',
  VITE_FIREBASE_STORAGE_BUCKET: 'prechocolatt.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1019627631263',
  VITE_FIREBASE_APP_ID: '1:1019627631263:web:82484bc7a2511d2534a8aa',
};
Object.assign(process.env, env);
await build({
  root,
  mode: 'pre',
  envDir: false,
  define: Object.fromEntries(Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
  build: { outDir: 'dist-pre', emptyOutDir: true },
  plugins: [{
    name: 'chocolatt-pre-label',
    transformIndexHtml(html) {
      return html.replace('<title>Chocolatt · Inventario</title>', '<title>Chocolatt PRE · PRUEBAS</title>')
        .replace('content="Chocolatt"', 'content="Chocolatt PRE"')
        .replace('<body>', '<body><div style="background:#ffd166;color:#171717;text-align:center;padding:6px;font:700 13px system-ui">CHOCOLATT PRE · DATOS DE PRUEBA</div>');
    },
  }],
});
const manifestPath = 'dist-pre/manifest.webmanifest';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.name = 'Chocolatt PRE · Pruebas';
manifest.short_name = 'Chocolatt PRE';
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
execFileSync(process.execPath, ['scripts/generate-sw.mjs', 'dist-pre'], { stdio: 'inherit' });
console.log('PRE generada en dist-pre. Proyecto exclusivo: prechocolatt.');
