/*
 * INTERFAZ: arma el formulario a partir de la configuración, maneja el
 * borrador, el envío, el resumen, los avisos y el restablecimiento.
 */
(function () {
  'use strict';

  var CONFIG = window.ENCUESTA_CONFIG;
  var L = window.EncuestaLogica;
  var P = CONFIG.preguntas;

  // ?simular=fallo-guardado → todas las escrituras fallan (para probar el aviso de error).
  var params = new URLSearchParams(window.location.search);
  var simularFallo = params.get('simular') === 'fallo-guardado';

  function obtenerStorage() {
    var real = null;
    try { real = window.localStorage; } catch (e) { real = null; }
    if (!real) {
      // Navegador sin acceso a localStorage: todo falla y la app lo avisa.
      return {
        getItem: function () { return null; },
        setItem: function () { throw new Error('localStorage no disponible'); },
        removeItem: function () { throw new Error('localStorage no disponible'); }
      };
    }
    if (!simularFallo) return real;
    return {
      getItem: function (k) { return real.getItem(k); },
      setItem: function () { throw new Error('Fallo de guardado simulado'); },
      removeItem: function () { throw new Error('Fallo de guardado simulado'); }
    };
  }

  var almacen = L.crearAlmacen(obtenerStorage(), CONFIG);

  var estado = {
    datos: null,
    borrador: L.borradorVacio(),
    editandoId: null,
    idPendiente: null,
    miRespuesta: null,
    recienEnviada: false,
    vista: 'formulario',
    confirmandoReset: false
  };

  var $ = function (id) { return document.getElementById(id); };
  var form = $('formulario');

  // ---------- utilidades ----------
  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function nuevoId() {
    return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function fecha(iso) {
    try {
      return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return iso; }
  }

  var temporizadorToast;
  function toast(mensaje) {
    var t = $('toast');
    t.textContent = mensaje;
    t.classList.add('visible');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () { t.classList.remove('visible'); }, 3200);
  }

  function aviso(tipo, titulo, texto, extraHtml) {
    return '<div class="aviso aviso-' + tipo + '"' + (tipo === 'error' ? ' role="alert"' : '') + '>' +
      '<strong>' + esc(titulo) + '</strong>' +
      (texto ? '<p>' + esc(texto) + '</p>' : '') + (extraHtml || '') + '</div>';
  }

  // ---------- construcción del formulario ----------
  function grupoOpciones(campo, tipo, clases) {
    var q = P[campo];
    var requerido = tipo === 'checkbox' ? (q.minimo || 0) > 0 : !!q.obligatorio;
    var html = '<fieldset class="tarjeta" id="grupo-' + campo + '" aria-describedby="error-' + campo + '">' +
      '<legend>' + esc(q.etiqueta) + (requerido ? '<span class="obligatorio" aria-hidden="true">*</span>' : '') + '</legend>' +
      (q.ayuda ? '<p class="ayuda">' + esc(q.ayuda) + '</p>' : '') +
      '<div class="opciones ' + (clases || '') + '">';
    q.opciones.forEach(function (o) {
      html += '<label class="chip"><input type="' + tipo + '" name="' + campo + '" value="' + esc(o.valor) + '"' +
        (requerido && tipo === 'radio' ? ' required' : '') + '><span>' + esc(o.etiqueta) + '</span></label>';
    });
    html += '</div><p class="error-campo" id="error-' + campo + '"></p></fieldset>';
    return html;
  }

  function construirFormulario() {
    var html = '';
    html += grupoOpciones('interes', 'radio', 'opciones-grandes');
    html += '<p class="nota-negativa" id="nota-negativa" hidden>Con «' +
      esc(L.etiqueta(CONFIG, 'interes', CONFIG.respuestaNegativa)) +
      '» solo guardamos tu decisión (y tu correo, si lo dejás).</p>';
    html += '<div id="condicionales">';
    html += grupoOpciones('dias', 'checkbox');
    html += grupoOpciones('horario', 'radio');
    html += grupoOpciones('categoria', 'radio');
    html += grupoOpciones('pareja', 'radio');
    html += grupoOpciones('precio', 'radio');
    html += grupoOpciones('cena', 'radio');
    html += '</div>';
    html += '<div class="tarjeta" id="grupo-correo">' +
      '<label class="etiqueta" for="correo">' + esc(P.correo.etiqueta) + '</label>' +
      (P.correo.ayuda ? '<p class="ayuda" id="ayuda-correo">' + esc(P.correo.ayuda) + '</p>' : '') +
      '<input type="email" id="correo" name="correo" autocomplete="email" inputmode="email" ' +
      'placeholder="nombre@dominio.com" aria-describedby="ayuda-correo error-correo">' +
      '<p class="error-campo" id="error-correo"></p></div>';
    html += '<button type="submit" class="boton boton-principal" id="boton-enviar">Enviar respuestas</button>';
    html += '<p class="leyenda-obligatorios"><span class="obligatorio">*</span> Obligatorio</p>';
    form.innerHTML = html;
  }

  function volcarBorradorEnFormulario() {
    var b = estado.borrador;
    Array.prototype.forEach.call(form.querySelectorAll('input[type="radio"]'), function (i) {
      i.checked = b[i.name] === i.value;
    });
    Array.prototype.forEach.call(form.querySelectorAll('input[name="dias"]'), function (i) {
      i.checked = (b.dias || []).indexOf(i.value) !== -1;
    });
    $('correo').value = b.correo || '';
    actualizarVisibilidad();
    mostrarErrores({});
  }

  function actualizarVisibilidad() {
    var negativa = L.esNegativa(estado.borrador, CONFIG);
    $('condicionales').hidden = negativa;
    $('nota-negativa').hidden = !negativa;
  }

  var CAMPOS = ['interes', 'dias', 'horario', 'categoria', 'pareja', 'precio', 'cena', 'correo'];

  function mostrarErrores(errores) {
    CAMPOS.forEach(function (c) {
      var msg = errores[c] || '';
      $('error-' + c).textContent = msg;
      var grupo = $('grupo-' + c);
      if (grupo) grupo.classList.toggle('con-error', !!msg);
      if (c === 'correo') $('correo').setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
  }

  function limpiarError(campo) {
    if (!$('error-' + campo)) return;
    $('error-' + campo).textContent = '';
    var grupo = $('grupo-' + campo);
    if (grupo) grupo.classList.remove('con-error');
    if (campo === 'correo') $('correo').setAttribute('aria-invalid', 'false');
  }

  function enfocarPrimerError(errores) {
    for (var i = 0; i < CAMPOS.length; i++) {
      if (errores[CAMPOS[i]]) {
        var el = CAMPOS[i] === 'correo' ? $('correo') : form.querySelector('input[name="' + CAMPOS[i] + '"]');
        if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return;
      }
    }
  }

  function guardarBorrador() {
    almacen.guardarBorrador(estado.borrador); // silencioso: si falla, lo elegido sigue en memoria
  }

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.name) return;
    if (t.name === 'dias') {
      estado.borrador.dias = Array.prototype.map.call(
        form.querySelectorAll('input[name="dias"]:checked'), function (i) { return i.value; });
    } else if (t.type === 'radio') {
      estado.borrador[t.name] = t.value;
    }
    limpiarError(t.name);
    if (t.name === 'interes') actualizarVisibilidad();
    guardarBorrador();
  });

  form.addEventListener('input', function (e) {
    if (e.target.name !== 'correo') return;
    estado.borrador.correo = e.target.value;
    limpiarError('correo');
    guardarBorrador();
  });

  form.addEventListener('focusout', function (e) {
    if (e.target.name !== 'correo') return;
    var c = e.target.value.trim();
    if (c && !L.correoValido(c)) {
      $('error-correo').textContent = P.correo.error;
      $('correo').setAttribute('aria-invalid', 'true');
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    enviar();
  });

  function enviar() {
    var resultado = L.validar(estado.borrador, CONFIG);
    mostrarErrores(resultado.errores);
    if (!resultado.valido) {
      $('aviso-formulario').innerHTML = aviso('error', 'Faltan datos', 'Revisá los campos marcados en rojo.');
      enfocarPrimerError(resultado.errores);
      return;
    }

    // El id se fija en el primer intento: si hay que reintentar, se reemplaza y no se duplica.
    if (!estado.idPendiente) estado.idPendiente = estado.editandoId || nuevoId();
    var respuesta = L.normalizar(estado.borrador, CONFIG, {
      id: estado.idPendiente,
      creadaEn: new Date().toISOString()
    });

    try {
      estado.datos = almacen.guardarRespuesta(estado.datos, respuesta);
    } catch (err) {
      if (window.console) console.error('No se pudo guardar la respuesta:', err);
      $('aviso-formulario').innerHTML = aviso('error', 'No pudimos guardar tu respuesta',
        'Puede que el almacenamiento del navegador esté lleno o bloqueado. Tus elecciones siguen acá abajo: probá de nuevo en un momento.',
        '<div class="acciones"><button type="button" class="boton boton-secundario" id="boton-reintentar">Reintentar</button></div>');
      $('boton-reintentar').addEventListener('click', enviar);
      $('aviso-formulario').scrollIntoView({ block: 'start', behavior: 'smooth' });
      return; // el formulario NO se limpia
    }

    almacen.borrarBorrador();
    estado.miRespuesta = respuesta;
    estado.idPendiente = null;
    estado.editandoId = null;
    estado.borrador = L.borradorVacio();
    estado.recienEnviada = true;
    estado.vista = 'resumen';
    render();
    window.scrollTo(0, 0);
    toast('¡Listo! Guardamos tu respuesta.');
  }

  // ---------- resumen ----------
  function filaRespuesta(rotulo, valor) {
    return '<dt>' + esc(rotulo) + '</dt><dd>' + esc(valor) + '</dd>';
  }

  function htmlMiRespuesta(r) {
    var sinDato = '—';
    var html = '<dl class="mi-respuesta">';
    html += filaRespuesta('Interés', L.etiqueta(CONFIG, 'interes', r.interes));
    if (!L.esNegativa(r, CONFIG)) {
      html += filaRespuesta('Días', (r.dias || []).map(function (d) { return L.etiqueta(CONFIG, 'dias', d); }).join(', '));
      html += filaRespuesta('Horario', L.etiqueta(CONFIG, 'horario', r.horario));
      html += filaRespuesta('Categoría', L.etiqueta(CONFIG, 'categoria', r.categoria));
      html += filaRespuesta('Pareja', r.pareja ? L.etiqueta(CONFIG, 'pareja', r.pareja) : sinDato);
      html += filaRespuesta('Precio por pareja', r.precio ? L.etiqueta(CONFIG, 'precio', r.precio) : sinDato);
      html += filaRespuesta('Paquete de cena', r.cena ? L.etiqueta(CONFIG, 'cena', r.cena) : sinDato);
    }
    html += filaRespuesta('Correo', r.correo || 'No lo dejaste');
    html += '</dl>';
    if (L.esNegativa(r, CONFIG)) {
      html += '<p class="nota-respuesta">Como elegiste «' + esc(L.etiqueta(CONFIG, 'interes', r.interes)) +
        '», no guardamos días, horario, categoría ni precio.</p>';
    }
    return html;
  }

  function htmlGrilla(resumen) {
    var dias = P.dias.opciones, horarios = P.horario.opciones;
    var max = resumen.masElegida ? resumen.masElegida.votos : 0;
    var html = '<table class="grilla"><caption class="visualmente-oculto">Votos por día y horario</caption><thead><tr><th scope="col"><span class="visualmente-oculto">Día</span></th>';
    horarios.forEach(function (h) { html += '<th scope="col">' + esc(h.etiqueta) + '</th>'; });
    html += '</tr></thead><tbody>';
    dias.forEach(function (d) {
      html += '<tr><th scope="row">' + esc(d.etiqueta) + '</th>';
      horarios.forEach(function (h) {
        var v = resumen.grilla[d.valor][h.valor];
        var clase = v === 0 ? 'cero' : (v === max ? 'max' : '');
        html += '<td class="' + clase + '">' + v + '</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table>';
  }

  function enlaceWhatsApp() {
    var url = CONFIG.compartir.url || (window.location.origin + window.location.pathname);
    if (!/^https?:/.test(url)) url = window.location.href.split('?')[0];
    return 'https://wa.me/?text=' + encodeURIComponent(CONFIG.compartir.texto + ' ' + url);
  }

  function renderResumen() {
    var r = estado.miRespuesta;
    var res = L.calcularResumen(estado.datos.respuestas, CONFIG);
    var html = '';

    if (estado.recienEnviada) {
      html += aviso('ok', '¡Gracias! Tu respuesta quedó guardada.', '');
    } else {
      html += aviso('info', 'Ya respondiste desde este dispositivo',
        'Lo hiciste el ' + fecha(r.creadaEn) + '. Podés revisar tu respuesta o editarla: al enviarla de nuevo se reemplaza, no se suma otra.');
    }

    html += '<div class="tarjeta resumen"><h2 id="titulo-resumen">Tu respuesta</h2>' + htmlMiRespuesta(r) + '</div>';

    html += '<div class="tarjeta resumen"><h2>Cómo viene la liga</h2><div class="cifras">';
    var si = res.porInteres.si || 0, talvez = res.porInteres.talvez || 0;
    html += '<div class="cifra"><div class="numero" id="cifra-interesados">' + res.interesados + '</div>' +
      '<div class="rotulo">Interesados (' + si + ' Sí · ' + talvez + ' Tal vez)</div></div>';
    html += '<div class="cifra"><div class="numero" id="cifra-total">' + res.total + '</div><div class="rotulo">Respuestas en total</div></div>';
    if (res.masElegida) {
      html += '<div class="cifra destacada"><div class="numero texto" id="cifra-combinacion">' +
        esc(L.etiqueta(CONFIG, 'dias', res.masElegida.dia)) + ' · ' + esc(L.etiqueta(CONFIG, 'horario', res.masElegida.horario)) +
        '</div><div class="rotulo">Combinación más elegida · ' + res.masElegida.votos + ' voto' + (res.masElegida.votos === 1 ? '' : 's') +
        (res.empate ? ' (empate: se muestra la primera)' : '') + '</div></div>';
    }
    html += '</div>';
    html += res.masElegida ? htmlGrilla(res)
      : '<p class="vacio" id="sin-combinaciones">Todavía no hay días y horarios elegidos.</p>';
    html += '</div>';

    html += '<div class="acciones">' +
      '<a class="boton boton-whatsapp" id="boton-whatsapp" target="_blank" rel="noopener" href="' + esc(enlaceWhatsApp()) + '">Compartir por WhatsApp</a>' +
      '<button type="button" class="boton boton-secundario" id="boton-editar">Editar mi respuesta</button></div>';

    $('vista-resumen').innerHTML = html;
    $('boton-editar').addEventListener('click', editar);
  }

  function editar() {
    estado.editandoId = estado.miRespuesta.id;
    estado.idPendiente = null;
    estado.borrador = L.aBorrador(estado.miRespuesta);
    estado.recienEnviada = false;
    estado.vista = 'formulario';
    render();
    $('aviso-formulario').innerHTML = aviso('info', 'Estás editando tu respuesta', 'Al enviarla reemplaza la anterior.',
      '<div class="acciones"><button type="button" class="boton boton-secundario" id="boton-cancelar-edicion">Cancelar y volver al resumen</button></div>');
    $('boton-cancelar-edicion').addEventListener('click', function () {
      estado.editandoId = null;
      estado.borrador = L.borradorVacio();
      estado.vista = 'resumen';
      render();
    });
    window.scrollTo(0, 0);
  }

  // ---------- restablecer ----------
  function renderRestablecer() {
    var zona = $('zona-restablecer');
    if (!estado.confirmandoReset) {
      zona.innerHTML = '<button type="button" class="boton-texto" id="boton-restablecer">Restablecer datos de ejemplo</button>';
      $('boton-restablecer').addEventListener('click', function () {
        estado.confirmandoReset = true;
        renderRestablecer();
        $('boton-confirmar-reset').focus();
      });
      return;
    }
    zona.innerHTML = '<div class="confirmar" role="group" aria-label="Confirmar restablecimiento">' +
      '<p>Se borran las respuestas guardadas en este navegador y vuelven las 10 respuestas de ejemplo. ¿Seguimos?</p>' +
      '<div class="acciones"><button type="button" class="boton boton-peligro" id="boton-confirmar-reset">Sí, restablecer</button>' +
      '<button type="button" class="boton boton-secundario" id="boton-cancelar-reset">Cancelar</button></div></div>';
    $('boton-confirmar-reset').addEventListener('click', restablecer);
    $('boton-cancelar-reset').addEventListener('click', function () {
      estado.confirmandoReset = false;
      renderRestablecer();
    });
  }

  function restablecer() {
    try {
      estado.datos = almacen.restablecer();
    } catch (err) {
      estado.confirmandoReset = false;
      renderRestablecer();
      $('avisos-globales').innerHTML = aviso('error', 'No se pudieron restablecer los datos',
        'El almacenamiento del navegador no respondió. Probá de nuevo.') + avisosPermanentes();
      return;
    }
    estado.borrador = L.borradorVacio();
    estado.miRespuesta = null;
    estado.editandoId = null;
    estado.idPendiente = null;
    estado.recienEnviada = false;
    estado.confirmandoReset = false;
    estado.vista = 'formulario';
    estado.avisoCarga = null;
    render();
    window.scrollTo(0, 0);
    toast('Datos de ejemplo restablecidos.');
  }

  // ---------- render general ----------
  function avisosPermanentes() {
    var html = '';
    if (simularFallo) {
      html += aviso('prueba', 'Modo prueba', 'El guardado va a fallar a propósito (?simular=fallo-guardado). Sacá ese parámetro de la dirección para volver a la normalidad.');
    }
    if (estado.avisoCarga === 'sin-acceso') {
      html += aviso('error', 'Este navegador no permite guardar',
        'Podés completar la encuesta, pero las respuestas no van a quedar guardadas (almacenamiento bloqueado o lleno, o modo privado).');
    } else if (estado.avisoCarga === 'danado') {
      html += aviso('error', 'Los datos guardados estaban dañados',
        'Te mostramos los datos de ejemplo. Usá «Restablecer datos de ejemplo» al pie para repararlos.');
    }
    return html;
  }

  function render() {
    $('avisos-globales').innerHTML = avisosPermanentes();
    var enFormulario = estado.vista === 'formulario';
    $('vista-formulario').hidden = !enFormulario;
    $('vista-resumen').hidden = enFormulario;
    if (enFormulario) {
      $('aviso-formulario').innerHTML = '';
      volcarBorradorEnFormulario();
    } else {
      renderResumen();
    }
    renderRestablecer();
  }

  // ---------- inicio ----------
  function iniciar() {
    $('titulo').textContent = CONFIG.club.nombre;
    $('bajada').textContent = CONFIG.club.bajada;
    construirFormulario();

    var carga = almacen.cargar();
    estado.datos = carga.datos;
    estado.avisoCarga = carga.origen === 'memoria' ? carga.motivo : null;

    var miId = almacen.miRespuestaId();
    var mia = null;
    if (miId) {
      for (var i = 0; i < estado.datos.respuestas.length; i++) {
        if (estado.datos.respuestas[i].id === miId) { mia = estado.datos.respuestas[i]; break; }
      }
    }

    if (mia) {
      estado.miRespuesta = mia;
      estado.vista = 'resumen';
    } else {
      var guardado = almacen.leerBorrador();
      if (guardado && typeof guardado === 'object') {
        estado.borrador = L.aBorrador(guardado);
      }
    }
    render();
  }

  iniciar();
})();
