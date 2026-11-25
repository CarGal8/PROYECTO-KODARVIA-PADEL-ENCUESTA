// Pruebas de reglas. Ejecutar con: npm test   (o: node --test tests/)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const L = require('../src/logic.js');

function storageFalso({ fallarEscritura = false } = {}) {
  const datos = new Map();
  return {
    datos,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { if (fallarEscritura) throw new Error('QuotaExceededError'); datos.set(k, String(v)); },
    removeItem: (k) => { if (fallarEscritura) throw new Error('QuotaExceededError'); datos.delete(k); }
  };
}

const borradorCompleto = {
  interes: 'si', dias: ['jueves', 'martes'], horario: '22:30', categoria: 'tercera',
  pareja: 'si', precio: '20000-25000', cena: 'si', correo: '  prueba@example.com '
};
const meta = { id: 'r-prueba', creadaEn: '2026-11-25T12:00:00.000Z' };

test('datos de ejemplo: 10 respuestas, 8 interesados y Martes 21:00 como más elegida', () => {
  const r = L.calcularResumen(CONFIG.datosDeEjemplo, CONFIG);
  assert.equal(r.total, 10);
  assert.equal(r.interesados, 8);
  assert.deepEqual(r.porInteres, { si: 6, talvez: 2, no: 2 });
  assert.deepEqual(r.masElegida, { dia: 'martes', horario: '21:00', votos: 5 });
  assert.equal(r.empate, false);
  assert.equal(r.grilla.jueves['21:00'], 2);
});

test('regla "respuesta negativa sin campos ocultos": descarta días, horario, categoría, precio (y el resto condicional)', () => {
  const borrador = Object.assign({}, borradorCompleto, { interes: 'no' });
  assert.equal(L.validar(borrador, CONFIG).valido, true);
  const r = L.normalizar(borrador, CONFIG, meta);
  assert.deepEqual(Object.keys(r).sort(), ['correo', 'creadaEn', 'id', 'interes']);
  assert.deepEqual(r, { id: 'r-prueba', creadaEn: meta.creadaEn, interes: 'no', correo: 'prueba@example.com' });
  CONFIG.camposCondicionales.forEach((c) => assert.equal(c in r, false, c + ' no debe existir'));
});

test('respuesta negativa sin correo es válida y guarda correo null', () => {
  const r = L.normalizar({ interes: 'no', dias: ['lunes'], horario: '19:30' }, CONFIG, meta);
  assert.deepEqual(r, { id: 'r-prueba', creadaEn: meta.creadaEn, interes: 'no', correo: null });
});

test('respuesta negativa con correo mal escrito no es válida', () => {
  const v = L.validar({ interes: 'no', correo: 'pepe@' }, CONFIG);
  assert.equal(v.valido, false);
  assert.ok(v.errores.correo);
});

test('interés es obligatorio', () => {
  const v = L.validar({}, CONFIG);
  assert.ok(v.errores.interes);
});

test('Sí / Tal vez: al menos un día, horario y categoría obligatorios; pareja, precio y cena opcionales', () => {
  const v = L.validar({ interes: 'talvez' }, CONFIG);
  assert.deepEqual(Object.keys(v.errores).sort(), ['categoria', 'dias', 'horario']);
  const ok = L.validar({ interes: 'talvez', dias: ['lunes'], horario: '19:30', categoria: 'segunda' }, CONFIG);
  assert.equal(ok.valido, true);
});

test('opciones fuera de la configuración se rechazan', () => {
  const v = L.validar(Object.assign({}, borradorCompleto, { dias: ['viernes'], horario: '18:00' }), CONFIG);
  assert.ok(v.errores.dias);
  assert.ok(v.errores.horario);
});

test('correo: opcional, pero si se completa tiene que tener formato válido', () => {
  ['', '   '].forEach((c) => assert.equal(L.validar(Object.assign({}, borradorCompleto, { correo: c }), CONFIG).valido, true));
  ['hola', 'a@b', 'a b@c.com', '@dominio.com'].forEach((c) =>
    assert.ok(L.validar(Object.assign({}, borradorCompleto, { correo: c }), CONFIG).errores.correo, c));
  assert.equal(L.correoValido('nombre@dominio.com'), true);
});

test('respuesta positiva: días ordenados y sin repetir, opcionales vacíos como null', () => {
  const r = L.normalizar({ interes: 'si', dias: ['jueves', 'lunes', 'jueves'], horario: '21:00', categoria: 'cuarta', correo: '' }, CONFIG, meta);
  assert.deepEqual(r.dias, ['lunes', 'jueves']);
  assert.equal(r.pareja, null);
  assert.equal(r.precio, null);
  assert.equal(r.cena, null);
  assert.equal(r.correo, null);
});

test('empate: gana la primera combinación según el orden de la configuración', () => {
  const res = L.calcularResumen([
    { id: 'a', interes: 'si', dias: ['jueves'], horario: '19:30' },
    { id: 'b', interes: 'si', dias: ['lunes'], horario: '22:30' }
  ], CONFIG);
  assert.deepEqual(res.masElegida, { dia: 'lunes', horario: '22:30', votos: 1 });
  assert.equal(res.empate, true);
});

test('sin interesados no hay combinación más elegida', () => {
  const res = L.calcularResumen([{ id: 'a', interes: 'no', correo: null }], CONFIG);
  assert.equal(res.interesados, 0);
  assert.equal(res.masElegida, null);
});

test('almacén: primera apertura carga los datos de ejemplo en la clave propia', () => {
  const s = storageFalso();
  const carga = L.crearAlmacen(s, CONFIG).cargar();
  assert.equal(carga.origen, 'ejemplo');
  const guardado = JSON.parse(s.getItem(CONFIG.almacenamiento.clave));
  assert.equal(guardado.respuestas.length, 10);
  // segunda apertura: lee lo guardado
  assert.equal(L.crearAlmacen(s, CONFIG).cargar().origen, 'guardado');
});

test('almacén: guardar agrega, editar reemplaza por id y marca la respuesta del dispositivo', () => {
  const s = storageFalso();
  const a = L.crearAlmacen(s, CONFIG);
  let datos = a.cargar().datos;
  datos = a.guardarRespuesta(datos, L.normalizar(Object.assign({}, borradorCompleto, { interes: 'no' }), CONFIG, meta));
  assert.equal(datos.respuestas.length, 11);
  assert.equal(a.miRespuestaId(), 'r-prueba');
  datos = a.guardarRespuesta(datos, L.normalizar({ interes: 'si', dias: ['martes'], horario: '21:00', categoria: 'cuarta' }, CONFIG, meta));
  assert.equal(datos.respuestas.length, 11);
  const res = L.calcularResumen(datos.respuestas, CONFIG);
  assert.equal(res.interesados, 9);
  assert.deepEqual(res.masElegida, { dia: 'martes', horario: '21:00', votos: 6 });
});

test('almacén: si falla el guardado lanza error y no altera los datos en memoria', () => {
  const s = storageFalso({ fallarEscritura: true });
  const a = L.crearAlmacen(s, CONFIG);
  const carga = a.cargar();
  assert.equal(carga.origen, 'memoria');
  const antes = JSON.stringify(carga.datos);
  assert.throws(() => a.guardarRespuesta(carga.datos, L.normalizar(borradorCompleto, CONFIG, meta)));
  assert.equal(JSON.stringify(carga.datos), antes);
});

test('almacén: datos dañados se informan y no se sobrescriben solos', () => {
  const s = storageFalso();
  s.setItem(CONFIG.almacenamiento.clave, '{no es json');
  const carga = L.crearAlmacen(s, CONFIG).cargar();
  assert.equal(carga.origen, 'memoria');
  assert.equal(carga.motivo, 'danado');
  assert.equal(s.getItem(CONFIG.almacenamiento.clave), '{no es json');
});

test('almacén: restablecer vuelve a los 10 de ejemplo y olvida respuesta y borrador del dispositivo', () => {
  const s = storageFalso();
  const a = L.crearAlmacen(s, CONFIG);
  let datos = a.cargar().datos;
  datos = a.guardarRespuesta(datos, L.normalizar(borradorCompleto, CONFIG, meta));
  a.guardarBorrador({ interes: 'si' });
  datos = a.restablecer();
  assert.equal(datos.respuestas.length, 10);
  assert.equal(a.miRespuestaId(), null);
  assert.equal(a.leerBorrador(), null);
  assert.deepEqual(L.calcularResumen(datos.respuestas, CONFIG).masElegida, { dia: 'martes', horario: '21:00', votos: 5 });
});
