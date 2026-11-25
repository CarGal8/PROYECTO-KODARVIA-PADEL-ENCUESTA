# Encuesta · Liga de parejas de pádel (noches de semana)

Encuesta para un club de pádel con cuatro canchas techadas que quiere lanzar una liga de parejas de lunes a jueves a la noche. Cada persona indica si le interesa, qué días puede jugar, en qué horario, su categoría y cuánto pagaría. Al final ve un resumen con su respuesta, cuántos interesados hay y la combinación de día y horario más elegida.

La aplicación está completa y funcionando: no usa backend y guarda todo en `localStorage`. Es HTML, CSS y JavaScript sin dependencias ni paso de compilación.

**URL de previsualización:** https://cargal8.github.io/PROYECTO-KODARVIA-PADEL-ENCUESTA/

**Repositorio:** https://github.com/CarGal8/PROYECTO-KODARVIA-PADEL-ENCUESTA

Para probar el aviso de error de guardado, agregá `?simular=fallo-guardado` al final de la URL (funciona en la previsualización y en local).

---

## Índice
1. [Cómo correrlo localmente](#1-cómo-correrlo-localmente)
2. [Estructura](#2-estructura)
3. [Clave propia de almacenamiento](#3-clave-propia-de-almacenamiento)
4. [Cambiar preguntas, días, horarios, categorías y rangos de precio](#4-cambiar-preguntas-días-horarios-categorías-y-rangos-de-precio)
5. [Preparar y reemplazar los datos de ejemplo](#5-preparar-y-reemplazar-los-datos-de-ejemplo)
6. [Cómo se calcula la combinación más elegida](#6-cómo-se-calcula-la-combinación-más-elegida)
7. [Botón «Restablecer datos de ejemplo»](#7-botón-restablecer-datos-de-ejemplo)
8. [Estados vacíos y errores](#8-estados-vacíos-y-errores)
9. [Reglas y pruebas](#9-reglas-y-pruebas)
10. [Decisiones tomadas](#10-decisiones-tomadas)
11. [Traspaso a Kodarvia](#11-traspaso-a-kodarvia)

---

## 1. Cómo correrlo localmente

Requisito: Node.js 18 o superior. No hay que instalar nada (`npm install` no es necesario).

```bash
npm start          # servidor estático en http://localhost:5173
npm test           # pruebas de reglas (node:test, 16 casos)
npm run build:preview   # genera dist/index.html: un único archivo con todo incrustado
```

Sin Node también funciona:
- con `python3 -m http.server 5173` desde la carpeta del proyecto, o
- abriendo `index.html` con doble clic. Algunos navegadores restringen `localStorage` en `file://`; si pasa, la app lo avisa. Por eso se recomienda usar un servidor.

Para publicarlo en un hosting estático (GitHub Pages, Netlify, Vercel, Lovable…) alcanza con subir la carpeta tal cual, o solo `dist/index.html`.

## 2. Estructura

```
index.html                 Estructura de la página
styles.css                 Estilos (mobile first)
src/config.js              ← TODO lo editable: textos, preguntas, opciones, clave, datos de ejemplo
src/logic.js               Lógica pura: validación, regla negativa, resumen, acceso a localStorage
src/app.js                 Interfaz: arma el formulario desde config.js, envío, resumen, avisos
tests/reglas.test.js       Pruebas automáticas de reglas (Node)
tests/e2e_navegador.py     Prueba guiada en navegador real (opcional, Playwright)
scripts/servir.js          Servidor local sin dependencias
scripts/armar-vista-previa.js  Genera dist/index.html (un solo archivo)
```

El formulario se arma **a partir de `src/config.js`**. Para cambiar preguntas u opciones no hay que tocar el HTML.

## 3. Clave propia de almacenamiento

La app usa tres claves con el prefijo propio `kodarvia:liga-padel-noches:v1`, así no choca con otras apps del mismo dominio:

| Clave | Contenido |
|---|---|
| `kodarvia:liga-padel-noches:v1` | Todas las respuestas: `{ version, respuestas: [...], actualizadoEn }` |
| `kodarvia:liga-padel-noches:v1:mi-respuesta` | `id` de la respuesta enviada desde este dispositivo (sirve para el aviso «Ya respondiste») |
| `kodarvia:liga-padel-noches:v1:borrador` | Borrador en curso. Se guarda mientras la persona completa y se borra al enviar |

Las claves se cambian en `CONFIG.almacenamiento`. Si cambia la forma de los datos, subí `version` y el sufijo (`v2`): los navegadores con datos viejos arrancan limpios con los datos de ejemplo.

## 4. Cambiar preguntas, días, horarios, categorías y rangos de precio

Todo se cambia en `src/config.js`, dentro de `CONFIG.preguntas`. Cada pregunta tiene esta forma:

```js
horario: {
  etiqueta: '¿Qué horario preferís?',   // texto visible
  ayuda: '...',                         // opcional, texto gris debajo
  obligatorio: true,                    // radios: obligatoria o no
  error: 'Elegí un horario.',           // mensaje si falta
  opciones: [
    { valor: '19:30', etiqueta: '19:30' },   // valor = lo que se guarda; etiqueta = lo que se ve
    ...
  ]
}
```

- **Días:** `preguntas.dias.opciones`. Para agregar el viernes: `{ valor: 'viernes', etiqueta: 'Viernes' }`. `minimo: 1` exige al menos un día.
- **Horarios:** `preguntas.horario.opciones`.
- **Categorías:** `preguntas.categoria.opciones`.
- **Rangos de precio:** `preguntas.precio.opciones`. Los montos actuales son de ejemplo. Para hacer obligatorio el precio, poné `obligatorio: true`.
- **Textos generales:** `CONFIG.club` (título y bajada) y `CONFIG.compartir` (mensaje y URL de WhatsApp).

Reglas a tener en cuenta:
- `valor` se guarda en `localStorage`: tiene que ser corto, sin espacios ni tildes. Cambiar una `etiqueta` es seguro. Cambiar un `valor` que ya tiene respuestas hace que esas respuestas dejen de contar para esa opción, así que actualizá también `datosDeEjemplo`.
- El **orden** de días y horarios define el orden en pantalla, en la grilla del resumen y en el desempate.
- Para agregar una pregunta **nueva** hay que sumarla en `config.js` y además en `src/app.js` (`construirFormulario` y `htmlMiRespuesta`) y en `src/logic.js` (`validar` y `normalizar`). Si depende del interés, agregala a `camposCondicionales`.

## 5. Preparar y reemplazar los datos de ejemplo

Al abrir la app por primera vez en un navegador (cuando no existe la clave principal), se guardan automáticamente las 10 respuestas de `CONFIG.datosDeEjemplo`. Así se ve funcionando desde el primer momento y no aparece una pantalla vacía.

Resultado esperado con los datos actuales: **10 respuestas · 8 interesados (6 Sí + 2 Tal vez) · combinación más elegida Martes · 21:00 con 5 votos**.

| id | interés | días | horario | categoría | pareja | precio | cena | correo |
|---|---|---|---|---|---|---|---|---|
| ejemplo-01 | si | martes, jueves | 21:00 | cuarta | si | 15000-20000 | si | ana.ejemplo@example.com |
| ejemplo-02 | si | martes | 21:00 | tercera | si | 20000-25000 | no | — |
| ejemplo-03 | talvez | lunes, martes | 21:00 | principiante | no | hasta-15000 | si | — |
| ejemplo-04 | si | martes, miércoles | 21:00 | segunda | si | mas-25000 | no | martin.ejemplo@example.com |
| ejemplo-05 | no | — | — | — | — | — | — | — |
| ejemplo-06 | si | miércoles | 19:30 | cuarta | no | 15000-20000 | si | — |
| ejemplo-07 | talvez | martes | 22:30 | tercera | si | 15000-20000 | no | lucia.ejemplo@example.com |
| ejemplo-08 | si | lunes, jueves | 19:30 | principiante | no | hasta-15000 | si | — |
| ejemplo-09 | no | — | — | — | — | — | — | pablo.ejemplo@example.com |
| ejemplo-10 | si | martes, jueves | 21:00 | cuarta | si | 20000-25000 | si | — |

**Para reemplazarlos:**
1. Editá el arreglo `datosDeEjemplo` en `src/config.js`. Usá ids que empiecen con `ejemplo-`, valores que existan en las opciones y respetá la regla negativa: una respuesta `no` lleva solo `id`, `creadaEn`, `interes` y `correo`.
2. Corré `npm test`. La primera prueba verifica el resultado esperado; actualizala si cambiaste la combinación ganadora a propósito.
3. En el navegador, tocá **«Restablecer datos de ejemplo»** para cargar los nuevos datos. También podés borrar la clave desde DevTools → Application → Local Storage.

Para arrancar **sin** datos de ejemplo en producción, dejá `datosDeEjemplo: []`. El resumen muestra entonces el estado vacío («Todavía no hay días y horarios elegidos»).

## 6. Cómo se calcula la combinación más elegida

Está en `calcularResumen` (`src/logic.js`):

1. Se toman solo los **interesados**: respuestas con interés `si` o `talvez`. Su cantidad es la cifra «Interesados».
2. Cada interesado elige un horario y uno o más días. Por **cada día elegido** suma **1 voto** a la combinación *día × horario*. Ejemplo: Martes + Jueves a las 21:00 suma 1 voto a Martes 21:00 y 1 a Jueves 21:00.
3. Gana la combinación con más votos.
4. **Empate:** gana la que aparece primero en la configuración, primero por día y después por horario. El resumen indica «empate: se muestra la primera».
5. Si nadie eligió días u horarios, no hay combinación y se muestra el estado vacío.

El resumen también muestra la grilla completa de votos (días × horarios), con la combinación máxima resaltada.

## 7. Botón «Restablecer datos de ejemplo»

Está al pie de la página y pide confirmación en la misma pantalla, sin ventanas emergentes del navegador. Al confirmar:
- reemplaza todas las respuestas guardadas por las 10 de ejemplo;
- borra la marca «ya respondiste» y el borrador de este dispositivo;
- vuelve al formulario vacío.

También sirve para reparar datos dañados. Si `localStorage` no responde, muestra un aviso de error y no cambia nada.

## 8. Estados vacíos y errores

| Situación | Qué ve la persona |
|---|---|
| Ya respondió desde este dispositivo | Al abrir va directo al resumen con el aviso «Ya respondiste desde este dispositivo» y la fecha. Puede **Editar mi respuesta**: al enviarla se **reemplaza** (mismo `id`), no se suma otra |
| Falla el guardado (almacenamiento lleno o bloqueado, modo privado) | Aviso rojo «No pudimos guardar tu respuesta» con botón **Reintentar**. El formulario **no se limpia**: todo lo elegido sigue marcado. El reintento usa el mismo `id`, así que no duplica |
| El navegador no permite guardar desde el inicio | Aviso permanente; se puede completar igual |
| Datos guardados dañados (JSON inválido) | Aviso que explica el problema y sugiere «Restablecer datos de ejemplo». Los datos dañados no se pisan solos |
| Sin combinaciones elegidas | «Todavía no hay días y horarios elegidos» |
| Campos incompletos o correo inválido | Mensaje debajo de cada campo, foco en el primero con error y aviso general |

---

## 9. Reglas y pruebas

### 9.1 Modelo de datos

```ts
// localStorage['kodarvia:liga-padel-noches:v1']
type Datos = {
  version: 1;
  respuestas: Respuesta[];
  actualizadoEn?: string;           // ISO 8601
};

type Respuesta = RespuestaPositiva | RespuestaNegativa;

type RespuestaPositiva = {
  id: string;                        // 'r-<base36>-<azar>' o 'ejemplo-NN'
  creadaEn: string;                  // ISO 8601
  ejemplo?: true;                    // solo en datos de ejemplo
  interes: 'si' | 'talvez';
  dias: ('lunes'|'martes'|'miercoles'|'jueves')[];  // ≥ 1, ordenados, sin repetidos
  horario: '19:30' | '21:00' | '22:30';
  categoria: 'principiante' | 'cuarta' | 'tercera' | 'segunda';
  pareja: 'si' | 'no' | null;
  precio: 'hasta-15000' | '15000-20000' | '20000-25000' | 'mas-25000' | null;
  cena: 'si' | 'no' | null;
  correo: string | null;             // con formato válido o null
};

type RespuestaNegativa = {           // SIN campos ocultos
  id: string;
  creadaEn: string;
  ejemplo?: true;
  interes: 'no';
  correo: string | null;
};
```

### 9.2 Regla «respuesta negativa sin campos ocultos»

> Al elegir **No me interesa** se guarda una respuesta válida con esa decisión y se descartan días, horario, categoría y precio del borrador anterior. Solo se conservan los campos comunes aplicables.

Implementación (`normalizar` en `src/logic.js`):
- **Campos comunes** (`CONFIG.camposComunes`): `interes` y `correo`. Siempre se conservan; el correo sigue visible con «No».
- **Campos condicionales** (`CONFIG.camposCondicionales`): `dias`, `horario`, `categoria`, `pareja`, `precio`, `cena`. Se ocultan al elegir «No» y **no existen como claves** en la respuesta guardada: no quedan en `null` ni vacíos, directamente no están.
- La validación de una respuesta negativa solo mira `interes` y el formato del correo. Por eso una respuesta «No» es válida aunque el borrador tuviera datos incompletos o raros.
- Mientras la persona duda, la interfaz conserva lo marcado en pantalla (si vuelve a «Sí» no pierde lo elegido). El descarte se aplica **al enviar**, y después se borra el borrador. Al editar una respuesta «No» guardada, el formulario aparece sin días ni horario.

### 9.3 Pruebas automáticas (`npm test`)

16 casos en `tests/reglas.test.js`:
- datos de ejemplo → 10 respuestas, 8 interesados, Martes 21:00 con 5 votos;
- regla negativa: con un borrador completo y `interes: 'no'`, las claves guardadas son exactamente `id, creadaEn, interes, correo`;
- obligatorios (interés; con Sí/Tal vez: ≥1 día, horario, categoría) y opcionales (pareja, precio, cena, correo);
- formato del correo, opciones fuera de la configuración, orden y deduplicación de días;
- desempate y estado sin interesados;
- almacenamiento: carga inicial en la clave propia, editar reemplaza por `id`, fallo de guardado (lanza error y no altera los datos), datos dañados, restablecer.

**Resultado observado:** `# pass 16 · # fail 0` (Node 22).

### 9.4 Prueba guiada: datos y resultado observado

Se ejecutó en Google Chrome (viewport móvil 420 px) con `python3 tests/e2e_navegador.py http://localhost:5173/`, partiendo de un navegador sin datos.

| Paso | Acción / datos | Resultado esperado | Resultado observado |
|---|---|---|---|
| 1 | Abrir por primera vez | 10 respuestas de ejemplo en `kodarvia:liga-padel-noches:v1` | ✅ 10 respuestas cargadas |
| 2 | Tocar «Enviar respuestas» sin completar | Error en interés | ✅ «Elegí si te interesa jugar.» |
| 2b | Elegir «Sí me anoto» y enviar | Errores en días, horario y categoría | ✅ los tres errores |
| 3 | Completar como Sí: **Martes + Jueves, 22:30, Tercera, pareja Sí, $20.000 a $25.000, cena Sí**. Cambiar a **No me interesa** | Se ocultan las preguntas condicionales | ✅ ocultas |
| 3b | Correo `prueba@` y enviar | Error de formato | ✅ «Revisá el formato del correo…» |
| 3c | Correo `prueba@example.com` y enviar | Se guarda `{ interes: 'no', correo: 'prueba@example.com' }` **sin** días, horario, categoría, precio, pareja ni cena | ✅ claves guardadas: `correo, creadaEn, id, interes` |
| 3d | Ver resumen | Total 11 · Interesados 8 · Martes · 21:00 (5) · enlace `https://wa.me/?text=…` | ✅ igual al esperado |
| 4 | Recargar la página | Aviso «Ya respondiste desde este dispositivo» | ✅ |
| 5 | «Editar mi respuesta»: aparece «No» sin días marcados. Cambiar a **Sí, Martes, 21:00, Cuarta** y enviar | Reemplaza (total sigue en 11) · Interesados 9 · Martes 21:00 con 6 votos | ✅ igual al esperado |
| 6 | Abrir con `?simular=fallo-guardado`, editar, sumar **Lunes**, elegir **19:30** y enviar | Aviso «No pudimos guardar tu respuesta»; siguen marcados Lunes, Martes y 19:30 | ✅ elecciones intactas |
| 7 | Sin el parámetro, «Restablecer datos de ejemplo» → «Sí, restablecer» | 10 respuestas, sin marca de dispositivo, formulario vacío | ✅ |
| 8 | Escribir `{roto` en la clave principal y recargar | Aviso «Los datos guardados estaban dañados»; Restablecer lo repara | ✅ |

No hubo errores de JavaScript en consola durante toda la prueba.

### 9.5 Verificación manual (checklist)

Para repetir a mano en cualquier navegador (DevTools → Application → Local Storage para mirar los datos):

- [ ] Primera apertura: aparece el formulario; en Local Storage existe `kodarvia:liga-padel-noches:v1` con 10 respuestas.
- [ ] Sin elegir interés se ven todas las preguntas; con «No me interesa» quedan solo interés y correo.
- [ ] No se puede enviar con Sí o Tal vez sin al menos un día, un horario y una categoría.
- [ ] Correo vacío: se acepta. Correo `hola@`: se rechaza.
- [ ] Hacer la prueba del punto 3 de la tabla: la respuesta guardada no tiene `dias`, `horario`, `categoria`, `precio`, `pareja` ni `cena`.
- [ ] El resumen muestra tu respuesta, los interesados (Sí + Tal vez) y la combinación más elegida, y coincide con la grilla.
- [ ] «Compartir por WhatsApp» abre WhatsApp (o WhatsApp Web) con el mensaje y el enlace.
- [ ] Al recargar aparece «Ya respondiste desde este dispositivo»; editar reemplaza y no duplica.
- [ ] Con `?simular=fallo-guardado`, el envío muestra el error y no se pierde nada de lo elegido.
- [ ] Completar a medias y recargar: el borrador se recupera.
- [ ] «Restablecer datos de ejemplo» pide confirmación y vuelve a 10 respuestas con Martes · 21:00.
- [ ] Probado en móvil (≈380 px) y escritorio; se puede usar todo con teclado (Tab, espacio y Enter).

---

## 10. Decisiones tomadas

Puntos que el briefing no especificaba y cómo se resolvieron. Todos se pueden cambiar en `config.js`:

- **Precio, pareja y cena son opcionales**, porque el briefing marca como obligatorios solo interés, días, horario y categoría. Para cambiarlo, `obligatorio: true`.
- **Rangos de precio de ejemplo** ($15.000 / $20.000 / $25.000). El club define los montos y la moneda definitivos.
- **El correo es un campo común**: se muestra y se guarda también con «No me interesa».
- **Sin interés elegido se ven todas las preguntas**, siguiendo el briefing: se muestran salvo que se elija «No».
- **Una respuesta por dispositivo**: volver a enviar reemplaza la anterior en lugar de sumar otra.
- **Textos en español rioplatense**, como el briefing.

## 11. Traspaso a Kodarvia

Queda listo para el pulido final (backend, conexiones reales, dominio, políticas legales, contenidos definitivos y producción):
- Para pasar a backend, el único punto a reemplazar es `crearAlmacen` en `src/logic.js`: misma interfaz (`cargar`, `guardarRespuesta`, `restablecer`…), con llamadas a una API en lugar de `localStorage`. La validación y la regla negativa ya están separadas en funciones puras y conviene replicarlas en el servidor.
- `CONFIG.compartir.url` es la URL pública definitiva que se comparte por WhatsApp.
- El modelo de datos de la sección 9.1 sirve como esquema de la tabla o colección.
