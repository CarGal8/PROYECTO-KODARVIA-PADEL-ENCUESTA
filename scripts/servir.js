// Servidor estático mínimo, sin dependencias. Uso: npm start  →  http://localhost:5173
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const PUERTO = Number(process.env.PORT) || 5173;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const archivo = path.join(RAIZ, ruta === '/' ? 'index.html' : ruta);
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  fs.readFile(archivo, (err, contenido) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(contenido);
  });
}).listen(PUERTO, () => console.log('Encuesta en http://localhost:' + PUERTO));
