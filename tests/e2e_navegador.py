"""Prueba guiada automatizada en un navegador real (opcional).

Requisitos: Python 3 + Playwright (pip install playwright && playwright install chromium).
Uso:  npm start   (en otra terminal)  y luego  python3 tests/e2e_navegador.py [URL]
"""
import json
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173/"
CLAVE = "kodarvia:liga-padel-noches:v1"
CAPTURAS = sys.argv[2] if len(sys.argv) > 2 else None


def texto(p, sel):
    return p.locator(sel).inner_text().strip()


def elegir(p, nombre, valor):
    p.locator(f'input[name="{nombre}"][value="{valor}"]').check(force=True)


def captura(p, nombre):
    if CAPTURAS:
        p.screenshot(path=f"{CAPTURAS}/{nombre}.png", full_page=True)


with sync_playwright() as pw:
    navegador = pw.chromium.launch(executable_path=None if "--chromium" in sys.argv else "/usr/bin/google-chrome")
    p = navegador.new_context(viewport={"width": 420, "height": 900}).new_page()
    errores_js = []
    p.on("pageerror", lambda e: errores_js.append(str(e)))

    # 1. Primera apertura: datos de ejemplo cargados
    p.goto(URL)
    datos = json.loads(p.evaluate(f"localStorage.getItem('{CLAVE}')"))
    assert len(datos["respuestas"]) == 10, "deben cargarse 10 respuestas de ejemplo"
    assert p.locator("#condicionales").is_visible(), "sin elegir interés se ve el resto"
    captura(p, "1-formulario")
    print("1. Primera apertura: 10 respuestas de ejemplo en", CLAVE)

    # 2. Validación: enviar vacío
    p.click("#boton-enviar")
    assert texto(p, "#error-interes"), "interés obligatorio"
    print("2. Enviar vacío → error en interés:", texto(p, "#error-interes"))

    elegir(p, "interes", "si")
    p.click("#boton-enviar")
    for c in ("dias", "horario", "categoria"):
        assert texto(p, f"#error-{c}"), c
    print("   Con «Sí me anoto» sin completar → errores en días, horario y categoría")

    # 3. Completar como Sí y después cambiar a No
    for d in ("martes", "jueves"):
        elegir(p, "dias", d)
    elegir(p, "horario", "22:30")
    elegir(p, "categoria", "tercera")
    elegir(p, "pareja", "si")
    elegir(p, "precio", "20000-25000")
    elegir(p, "cena", "si")
    elegir(p, "interes", "no")
    assert not p.locator("#condicionales").is_visible(), "con No se ocultan las preguntas"
    p.fill("#correo", "prueba@")
    p.click("#boton-enviar")
    assert texto(p, "#error-correo"), "correo inválido"
    print("3. Sí completo → cambio a «No me interesa»: preguntas ocultas; correo 'prueba@' rechazado")
    p.fill("#correo", "prueba@example.com")
    p.click("#boton-enviar")
    p.wait_for_selector("#vista-resumen:not([hidden])")
    datos = json.loads(p.evaluate(f"localStorage.getItem('{CLAVE}')"))
    propia = datos["respuestas"][-1]
    claves = sorted(k for k in propia.keys())
    assert claves == ["correo", "creadaEn", "id", "interes"], claves
    assert propia["interes"] == "no" and propia["correo"] == "prueba@example.com"
    assert texto(p, "#cifra-total") == "11" and texto(p, "#cifra-interesados") == "8"
    assert texto(p, "#cifra-combinacion") == "Martes · 21:00"
    captura(p, "2-resumen-negativa")
    print("   Guardado:", json.dumps({k: propia[k] for k in ("interes", "correo")}), "· claves:", claves)
    print("   Resumen: total 11 · interesados 8 · más elegida", texto(p, "#cifra-combinacion"))

    wa = p.get_attribute("#boton-whatsapp", "href")
    assert wa.startswith("https://wa.me/?text="), wa
    print("   WhatsApp:", wa[:70] + "…")

    # 4. Recargar: aviso de ya respondido
    p.reload()
    assert "Ya respondiste desde este dispositivo" in p.inner_text("#vista-resumen")
    print("4. Recarga → aviso «Ya respondiste desde este dispositivo»")

    # 5. Editar → Sí, Martes 21:00
    p.click("#boton-editar")
    assert p.locator('input[name="interes"][value="no"]').is_checked()
    assert p.locator('input[name="dias"]:checked').count() == 0, "no quedan días del borrador anterior"
    elegir(p, "interes", "si")
    elegir(p, "dias", "martes")
    elegir(p, "horario", "21:00")
    elegir(p, "categoria", "cuarta")
    p.click("#boton-enviar")
    p.wait_for_selector("#vista-resumen:not([hidden])")
    assert texto(p, "#cifra-total") == "11", "editar reemplaza, no suma"
    assert texto(p, "#cifra-interesados") == "9"
    assert "6 votos" in p.inner_text("#vista-resumen")
    print("5. Editar a Sí · Martes · 21:00 → total 11 (reemplaza) · interesados 9 · Martes 21:00 con 6 votos")

    # 6. Fallo de guardado simulado sin perder lo elegido
    p.goto(URL + "?simular=fallo-guardado")
    p.click("#boton-editar")
    elegir(p, "dias", "lunes")
    elegir(p, "horario", "19:30")
    p.click("#boton-enviar")
    assert "No pudimos guardar tu respuesta" in p.inner_text("#aviso-formulario")
    assert p.locator('input[name="dias"][value="lunes"]').is_checked()
    assert p.locator('input[name="dias"][value="martes"]').is_checked()
    assert p.locator('input[name="horario"][value="19:30"]').is_checked()
    assert p.locator("#vista-formulario").is_visible()
    captura(p, "3-error-guardado")
    print("6. ?simular=fallo-guardado → aviso «No pudimos guardar tu respuesta», elecciones intactas (Lunes+Martes, 19:30)")

    # 7. Restablecer datos de ejemplo
    p.goto(URL)
    p.click("#boton-restablecer")
    p.click("#boton-confirmar-reset")
    datos = json.loads(p.evaluate(f"localStorage.getItem('{CLAVE}')"))
    assert len(datos["respuestas"]) == 10
    assert p.evaluate(f"localStorage.getItem('{CLAVE}:mi-respuesta')") is None
    assert p.locator("#vista-formulario").is_visible()
    print("7. Restablecer → 10 respuestas de ejemplo, sin respuesta propia, formulario vacío")

    # 8. Datos dañados
    p.evaluate(f"localStorage.setItem('{CLAVE}', '{{roto')")
    p.reload()
    assert "Los datos guardados estaban dañados" in p.inner_text("#avisos-globales")
    p.click("#boton-restablecer")
    p.click("#boton-confirmar-reset")
    assert "dañados" not in p.inner_text("#avisos-globales")
    print("8. Datos dañados → aviso claro; Restablecer los repara")

    assert not errores_js, errores_js
    print("\nOK: prueba guiada completa, sin errores de JavaScript.")
    navegador.close()
