/*
 * LÓGICA PURA DE LA ENCUESTA (sin DOM)
 * Validación, regla de respuesta negativa, resumen y acceso a localStorage.
 * Se usa en el navegador (window.EncuestaLogica) y en las pruebas de Node.
 */
(function (root) {
  'use strict';

  var RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function valores(pregunta) {
    return pregunta.opciones.map(function (o) { return o.valor; });
  }

  function limpiarCorreo(correo) {
    return typeof correo === 'string' ? correo.trim() : '';
  }

  function correoValido(correo) {
    return RE_CORREO.test(correo);
  }

  function esNegativa(borrador, config) {
    return !!borrador && borrador.interes === config.respuestaNegativa;
  }

  /** Días válidos, sin repetir y en el orden de la configuración. */
  function ordenarDias(dias, config) {
    var elegidos = Array.isArray(dias) ? dias : [];
    return valores(config.preguntas.dias).filter(function (v) {
      return elegidos.indexOf(v) !== -1;
    });
  }

  function borradorVacio() {
    return { interes: '', dias: [], horario: '', categoria: '', pareja: '', precio: '', cena: '', correo: '' };
  }

  /**
   * Valida un borrador. Devuelve { valido, errores: { campo: mensaje } }.
   * Si la respuesta es negativa solo se validan los campos comunes.
   */
  function validar(borrador, config) {
    var p = config.preguntas;
    var errores = {};
    var b = borrador || {};

    if (!b.interes || valores(p.interes).indexOf(b.interes) === -1) {
      errores.interes = p.interes.error || 'Elegí una opción.';
    }

    var correo = limpiarCorreo(b.correo);
    if (correo && !correoValido(correo)) {
      errores.correo = p.correo.error || 'Correo no válido.';
    }

    if (!errores.interes && !esNegativa(b, config)) {
      var elegidos = Array.isArray(b.dias) ? b.dias : [];
      var diasOk = ordenarDias(elegidos, config);
      if (diasOk.length !== elegidos.filter(function (d, i) { return elegidos.indexOf(d) === i; }).length) {
        errores.dias = 'Hay un día que no es válido.';
      } else if (diasOk.length < (p.dias.minimo || 0)) {
        errores.dias = p.dias.error || 'Elegí al menos un día.';
      }

      ['horario', 'categoria', 'pareja', 'precio', 'cena'].forEach(function (campo) {
        var q = p[campo];
        var v = b[campo];
        if (v && valores(q).indexOf(v) === -1) {
          errores[campo] = 'Opción no válida.';
        } else if (q.obligatorio && !v) {
          errores[campo] = q.error || 'Elegí una opción.';
        }
      });
    }

    return { valido: Object.keys(errores).length === 0, errores: errores };
  }

  /**
   * Convierte un borrador válido en la respuesta que se guarda.
   * REGLA "respuesta negativa sin campos ocultos": si interes === 'no'
   * se guarda una respuesta válida con esa decisión y SOLO los campos comunes
   * (interes y correo). Días, horario, categoría, precio, pareja y cena del
   * borrador anterior se descartan: ni siquiera existen como claves.
   */
  function normalizar(borrador, config, meta) {
    var b = borrador || {};
    var respuesta = {
      id: meta.id,
      creadaEn: meta.creadaEn,
      interes: b.interes
    };

    if (!esNegativa(b, config)) {
      respuesta.dias = ordenarDias(b.dias, config);
      respuesta.horario = b.horario;
      respuesta.categoria = b.categoria;
      respuesta.pareja = b.pareja || null;
      respuesta.precio = b.precio || null;
      respuesta.cena = b.cena || null;
    }

    respuesta.correo = limpiarCorreo(b.correo) || null;
    return respuesta;
  }

  /** Pasa una respuesta guardada a borrador (para editarla). */
  function aBorrador(respuesta) {
    var b = borradorVacio();
    if (!respuesta) return b;
    Object.keys(b).forEach(function (k) {
      if (respuesta[k] !== undefined && respuesta[k] !== null) {
        b[k] = Array.isArray(respuesta[k]) ? respuesta[k].slice() : respuesta[k];
      }
    });
    return b;
  }

  /**
   * Resumen general.
   * - interesados = respuestas con interes distinto de la negativa (Sí + Tal vez).
   * - Cada interesado suma 1 voto a cada combinación (día elegido × su horario).
   * - La combinación más elegida es la de más votos; si hay empate gana la que
   *   aparece primero en la configuración (primero por día, luego por horario).
   */
  function calcularResumen(respuestas, config) {
    var lista = Array.isArray(respuestas) ? respuestas : [];
    var dias = valores(config.preguntas.dias);
    var horarios = valores(config.preguntas.horario);

    var porInteres = {};
    valores(config.preguntas.interes).forEach(function (v) { porInteres[v] = 0; });

    var grilla = {};
    dias.forEach(function (d) {
      grilla[d] = {};
      horarios.forEach(function (h) { grilla[d][h] = 0; });
    });

    var interesados = 0;
    lista.forEach(function (r) {
      if (porInteres[r.interes] === undefined) return; // dato desconocido: se ignora
      porInteres[r.interes] += 1;
      if (r.interes === config.respuestaNegativa) return;
      interesados += 1;
      if (horarios.indexOf(r.horario) === -1) return;
      ordenarDias(r.dias, config).forEach(function (d) { grilla[d][r.horario] += 1; });
    });

    var combinaciones = [];
    dias.forEach(function (d, i) {
      horarios.forEach(function (h, j) {
        combinaciones.push({ dia: d, horario: h, votos: grilla[d][h], orden: i * horarios.length + j });
      });
    });
    combinaciones.sort(function (a, b) { return b.votos - a.votos || a.orden - b.orden; });

    var max = combinaciones.length ? combinaciones[0].votos : 0;
    var masElegida = max > 0 ? { dia: combinaciones[0].dia, horario: combinaciones[0].horario, votos: max } : null;
    var empatadas = max > 0 ? combinaciones.filter(function (c) { return c.votos === max; }).length : 0;

    return {
      total: lista.length,
      interesados: interesados,
      porInteres: porInteres,
      grilla: grilla,
      masElegida: masElegida,
      empate: empatadas > 1
    };
  }

  function etiqueta(config, campo, valor) {
    var q = config.preguntas[campo];
    if (!q || !q.opciones) return valor;
    for (var i = 0; i < q.opciones.length; i++) {
      if (q.opciones[i].valor === valor) return q.opciones[i].etiqueta;
    }
    return valor;
  }

  function datosIniciales(config) {
    return {
      version: config.version,
      respuestas: JSON.parse(JSON.stringify(config.datosDeEjemplo))
    };
  }

  /**
   * Acceso a localStorage (o a cualquier objeto con getItem/setItem/removeItem).
   * Las escrituras de respuestas LANZAN error si fallan, para que la interfaz
   * avise sin perder lo elegido. El borrador se guarda en silencio.
   */
  function crearAlmacen(storage, config) {
    var k = config.almacenamiento;

    function leer(clave) {
      var crudo = storage.getItem(clave);
      return crudo == null ? null : JSON.parse(crudo);
    }

    return {
      /** { datos, origen: 'guardado' | 'ejemplo' | 'memoria', error? } */
      cargar: function () {
        var datos;
        try {
          datos = leer(k.clave);
        } catch (err) {
          return { datos: datosIniciales(config), origen: 'memoria', error: err, motivo: 'danado' };
        }
        if (datos && Array.isArray(datos.respuestas)) {
          return { datos: datos, origen: 'guardado' };
        }
        datos = datosIniciales(config);
        try {
          storage.setItem(k.clave, JSON.stringify(datos));
          return { datos: datos, origen: 'ejemplo' };
        } catch (err2) {
          return { datos: datos, origen: 'memoria', error: err2, motivo: 'sin-acceso' };
        }
      },

      /** Agrega o reemplaza (mismo id) la respuesta. Devuelve los datos nuevos o lanza error. */
      guardarRespuesta: function (datos, respuesta) {
        var nuevas = datos.respuestas.filter(function (r) { return r.id !== respuesta.id; });
        nuevas.push(respuesta);
        var nuevosDatos = { version: config.version, respuestas: nuevas, actualizadoEn: respuesta.creadaEn };
        storage.setItem(k.clave, JSON.stringify(nuevosDatos));
        storage.setItem(k.claveMiRespuesta, respuesta.id);
        return nuevosDatos;
      },

      miRespuestaId: function () {
        try { return storage.getItem(k.claveMiRespuesta); } catch (e) { return null; }
      },

      leerBorrador: function () {
        try { return leer(k.claveBorrador); } catch (e) { return null; }
      },

      guardarBorrador: function (borrador) {
        try { storage.setItem(k.claveBorrador, JSON.stringify(borrador)); return true; } catch (e) { return false; }
      },

      borrarBorrador: function () {
        try { storage.removeItem(k.claveBorrador); } catch (e) { /* sin efecto */ }
      },

      /** Vuelve a los 10 datos de ejemplo y olvida la respuesta de este dispositivo. Lanza error si falla. */
      restablecer: function () {
        var datos = datosIniciales(config);
        storage.setItem(k.clave, JSON.stringify(datos));
        storage.removeItem(k.claveMiRespuesta);
        storage.removeItem(k.claveBorrador);
        return datos;
      }
    };
  }

  var API = {
    correoValido: correoValido,
    esNegativa: esNegativa,
    ordenarDias: ordenarDias,
    borradorVacio: borradorVacio,
    validar: validar,
    normalizar: normalizar,
    aBorrador: aBorrador,
    calcularResumen: calcularResumen,
    etiqueta: etiqueta,
    datosIniciales: datosIniciales,
    crearAlmacen: crearAlmacen
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    root.EncuestaLogica = API;
  }
})(typeof window !== 'undefined' ? window : this);
