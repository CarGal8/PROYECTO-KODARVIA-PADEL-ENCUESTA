// Genera dist/index.html: un único archivo con CSS y JS incrustados (para hosting
// de un solo archivo o vista previa). Uso: npm run build:preview
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');

let html = leer('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => '<style>\n' + leer(href) + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => '<script>\n' + leer(src).replace(/<\/script/gi, '<\\/script') + '\n</script>');

fs.mkdirSync(path.join(RAIZ, 'dist'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'dist', 'index.html'), html);
console.log('Listo: dist/index.html (' + Buffer.byteLength(html) + ' bytes)');
