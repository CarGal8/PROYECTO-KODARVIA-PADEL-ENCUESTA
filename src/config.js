/*
 * CONFIGURACIÓN EDITABLE DE LA ENCUESTA
 * ------------------------------------
 * Todo lo que el club puede querer cambiar está acá: textos, preguntas,
 * opciones (días, horarios, categorías, rangos de precio), qué es obligatorio,
 * la clave de almacenamiento y los datos de ejemplo.
 *
 * Reglas al editar:
 *  - `valor` es lo que se guarda en localStorage: corto, sin espacios ni tildes.
 *    Si cambiás un `valor` que ya tiene respuestas guardadas, esas respuestas
 *    dejan de contar para esa opción (cambiá también `datosDeEjemplo`).
 *  - `etiqueta` es lo que ve la persona: se puede cambiar libremente.
 *  - El orden de `dias` y `horarios` es el que se usa para desempatar la
 *    combinación más elegida (gana la que aparece primero).
 *  - Si cambiás la forma de los datos, subí `version` y el sufijo de las claves.
 */
(function (root) {
  'use strict';

  var CONFIG = {
    version: 1,

    almacenamiento: {
      // Clave propia de la app. El prefijo evita choques con otras apps del mismo dominio.
      clave: 'kodarvia:liga-padel-noches:v1',
      claveMiRespuesta: 'kodarvia:liga-padel-noches:v1:mi-respuesta',
      claveBorrador: 'kodarvia:liga-padel-noches:v1:borrador'
    },

    club: {
      nombre: 'Liga de parejas · Noches de semana',
      bajada: 'Cuatro canchas techadas, de lunes a jueves. Contanos cuándo podés jugar y armamos la liga.'
    },

    compartir: {
      // Si queda vacío se comparte la dirección actual de la página (sin parámetros).
      url: '',
      texto: '¡Se viene la liga de parejas en las noches de semana! Completá la encuesta acá:'
    },

    // Valor de `interes` que activa la regla "respuesta negativa sin campos ocultos".
    respuestaNegativa: 'no',

    // Campos que solo existen si la respuesta NO es negativa. Se descartan al elegir "No me interesa".
    camposCondicionales: ['dias', 'horario', 'categoria', 'pareja', 'precio', 'cena'],
    // Campos comunes: se conservan siempre.
    camposComunes: ['interes', 'correo'],

    preguntas: {
      interes: {
        etiqueta: '¿Te sumás a la liga de parejas?',
        obligatorio: true,
        error: 'Elegí si te interesa jugar.',
        opciones: [
          { valor: 'si', etiqueta: 'Sí me anoto' },
          { valor: 'talvez', etiqueta: 'Tal vez' },
          { valor: 'no', etiqueta: 'No me interesa' }
        ]
      },
      dias: {
        etiqueta: '¿Qué días podrías jugar?',
        ayuda: 'Marcá todos los que te sirvan.',
        minimo: 1,
        error: 'Elegí al menos un día.',
        opciones: [
          { valor: 'lunes', etiqueta: 'Lunes' },
          { valor: 'martes', etiqueta: 'Martes' },
          { valor: 'miercoles', etiqueta: 'Miércoles' },
          { valor: 'jueves', etiqueta: 'Jueves' }
        ]
      },
      horario: {
        etiqueta: '¿Qué horario preferís?',
        obligatorio: true,
        error: 'Elegí un horario.',
        opciones: [
          { valor: '19:30', etiqueta: '19:30' },
          { valor: '21:00', etiqueta: '21:00' },
          { valor: '22:30', etiqueta: '22:30' }
        ]
      },
      categoria: {
        etiqueta: '¿En qué categoría jugás?',
        obligatorio: true,
        error: 'Elegí tu categoría.',
        opciones: [
          { valor: 'principiante', etiqueta: 'Principiante' },
          { valor: 'cuarta', etiqueta: 'Cuarta' },
          { valor: 'tercera', etiqueta: 'Tercera' },
          { valor: 'segunda', etiqueta: 'Segunda' }
        ]
      },
      pareja: {
        etiqueta: '¿Ya tenés pareja para jugar?',
        obligatorio: false,
        opciones: [
          { valor: 'si', etiqueta: 'Sí' },
          { valor: 'no', etiqueta: 'No' }
        ]
      },
      precio: {
        etiqueta: '¿Cuánto pagarían por pareja por fecha?',
        ayuda: 'Montos de ejemplo: el club define los definitivos.',
        obligatorio: false,
        opciones: [
          { valor: 'hasta-15000', etiqueta: 'Hasta $15.000' },
          { valor: '15000-20000', etiqueta: '$15.000 a $20.000' },
          { valor: '20000-25000', etiqueta: '$20.000 a $25.000' },
          { valor: 'mas-25000', etiqueta: 'Más de $25.000' }
        ]
      },
      cena: {
        etiqueta: '¿Te interesa un paquete de cena después del partido?',
        obligatorio: false,
        opciones: [
          { valor: 'si', etiqueta: 'Sí' },
          { valor: 'no', etiqueta: 'No' }
        ]
      },
      correo: {
        etiqueta: 'Correo electrónico (opcional)',
        ayuda: 'Solo para avisarte cuando abra la inscripción.',
        obligatorio: false,
        error: 'Revisá el formato del correo (por ejemplo: nombre@dominio.com).'
      }
    },

    /*
     * 10 respuestas sintéticas que se cargan al abrir por primera vez.
     * Resultado esperado: 8 interesados (6 Sí + 2 Tal vez) y
     * Martes · 21:00 como combinación más elegida (5 votos).
     */
    datosDeEjemplo: [
      { id: 'ejemplo-01', creadaEn: '2026-11-18T22:05:00.000Z', ejemplo: true, interes: 'si', dias: ['martes', 'jueves'], horario: '21:00', categoria: 'cuarta', pareja: 'si', precio: '15000-20000', cena: 'si', correo: 'ana.ejemplo@example.com' },
      { id: 'ejemplo-02', creadaEn: '2026-11-18T23:12:00.000Z', ejemplo: true, interes: 'si', dias: ['martes'], horario: '21:00', categoria: 'tercera', pareja: 'si', precio: '20000-25000', cena: 'no', correo: null },
      { id: 'ejemplo-03', creadaEn: '2026-11-19T12:40:00.000Z', ejemplo: true, interes: 'talvez', dias: ['lunes', 'martes'], horario: '21:00', categoria: 'principiante', pareja: 'no', precio: 'hasta-15000', cena: 'si', correo: null },
      { id: 'ejemplo-04', creadaEn: '2026-11-19T14:02:00.000Z', ejemplo: true, interes: 'si', dias: ['martes', 'miercoles'], horario: '21:00', categoria: 'segunda', pareja: 'si', precio: 'mas-25000', cena: 'no', correo: 'martin.ejemplo@example.com' },
      { id: 'ejemplo-05', creadaEn: '2026-11-19T18:30:00.000Z', ejemplo: true, interes: 'no', correo: null },
      { id: 'ejemplo-06', creadaEn: '2026-11-20T09:15:00.000Z', ejemplo: true, interes: 'si', dias: ['miercoles'], horario: '19:30', categoria: 'cuarta', pareja: 'no', precio: '15000-20000', cena: 'si', correo: null },
      { id: 'ejemplo-07', creadaEn: '2026-11-20T21:47:00.000Z', ejemplo: true, interes: 'talvez', dias: ['martes'], horario: '22:30', categoria: 'tercera', pareja: 'si', precio: '15000-20000', cena: 'no', correo: 'lucia.ejemplo@example.com' },
      { id: 'ejemplo-08', creadaEn: '2026-11-21T11:20:00.000Z', ejemplo: true, interes: 'si', dias: ['lunes', 'jueves'], horario: '19:30', categoria: 'principiante', pareja: 'no', precio: 'hasta-15000', cena: 'si', correo: null },
      { id: 'ejemplo-09', creadaEn: '2026-11-21T16:55:00.000Z', ejemplo: true, interes: 'no', correo: 'pablo.ejemplo@example.com' },
      { id: 'ejemplo-10', creadaEn: '2026-11-22T20:10:00.000Z', ejemplo: true, interes: 'si', dias: ['martes', 'jueves'], horario: '21:00', categoria: 'cuarta', pareja: 'si', precio: '20000-25000', cena: 'si', correo: null }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
  } else {
    root.ENCUESTA_CONFIG = CONFIG;
  }
})(typeof window !== 'undefined' ? window : this);
