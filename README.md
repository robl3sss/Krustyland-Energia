# Krustyland · Práctica 6 · Energía mecánica

Simulador 3D de un carrito de un asiento y dos vueltas verticales, con
llegada abajo. La pista es didáctica; no reproduce La Avalancha del IRTRA.

## Abrir el simulador

El sitio completo está en `dist/`. Para ejecutarlo localmente:

```sh
python -m http.server 8000 --directory dist
```

Abre http://localhost:8000. Para las pruebas, ejecuta `npm ci` primero.
En GitHub Pages, usa la rama `main` y la carpeta `/ (root)`.

## Uso

La intro conserva el video completo del usuario (66.87 s) y su música.
Práctica 6 aparece en tamaño grande. El único botón de entrada dice
Reproducir; activa el audio mediante un gesto del usuario. No hay textos
explicativos debajo. Pausa, volumen y avance usan los controles del video.
Omitir intro, Escape y terminar la reproducción abren el simulador.

Elige un personaje o Toda la familia al principio. El modo familiar usa
cinco carritos articulados, uno por pasajero, con masas editables por separado.
Las masas iniciales suman 240 kg; cinco carros de 55 kg suman 275 kg y la
masa total es 515 kg. El tramo de embarque se amplía para alojar el tren.

Elige uno de los cinco personajes al principio. La vista de embarque permite
verlo en su carrito. Después ajusta masa, altura, radio y rozamiento. Iniciar
pasa a seguimiento; también hay panorámica, lateral y POV desde el asiento.

Capturar PNG guarda la escena con parámetros y mediciones. Resultados CSV
guarda todas las muestras y la parada final, con unidades en los encabezados.
Gráficas PNG guarda ambos gráficos. Los datos se pueden mostrar en J o J/kg.

## Movimiento y escena

Los modelos del usuario conservan geometría y texturas. Un esqueleto de nueve
huesos articula caderas, rodillas, torso, cabeza, brazos y codos. La pose
sentada y los movimientos suaves de respiración, mirada y reacción a la
aceleración son visuales y no modifican el cálculo físico. Se suavizan las
transiciones; la preferencia de movimiento reducido suprime los gestos.
Los personajes pequeños usan elevador. Las caras se articulan como piezas
rígidas para evitar deformaciones; se redujo el balanceo y se ajustaron las
barras de cintura y los reposapiés por pasajero. No hay caída de entrada al
asiento ni arcos que tapen las caras. Las ruedas y guías giran según la
distancia recorrida. La cámara de seguimiento mantiene el horizonte estable;
POV gira con el carrito y oculta al pasajero para evitar atravesar su cuerpo.

La torre de salida tiene cuatro columnas y diagonales. La bajada usa pórticos
estrechos y las vueltas tienen marcos circulares traseros con ménsulas hasta
la espina del riel. Los soportes bajos continúan hasta la llegada. Se dibujan
por instancias. Se comprueba su paso contra cinco cajas orientadas: carrocería
y pasajero, y los cuatro conjuntos de ruedas. La separación del hueco central
permite unir la estructura a la espina sin cruzar las ruedas de sujeción.
Las estructuras traseras están fuera de las calles de paso. Una prueba densa
independiente comprueba todos los segmentos con Ray/Box de Three.js.

La cabeza de Krusty procede del FBX suministrado. Se conservan toda su
geometría, ojos, nariz, boca, UV y ambas texturas. Solo se suavizan normales.
Se retiraron todas las piezas faciales añadidas. La presentación en relieve
mantiene el cabello delante de la placa, sin atravesarla.

## Modelo físico

La coordenada s es longitud de arco y v su velocidad firmada:

    ds/dt = v
    dv/dt = g · T - mu |N/m| sign(v)
    d(Q/m)/dt = mu |N/m| |v|
    N/m = v² k - (g - T(g · T))

T es tangente unitaria y k = dT/ds curvatura vectorial. g = 9.81 m/s². Se usa
una partícula sobre un riel capturado, sin aire ni energía de rotación de
ruedas. En reposo se usa el mismo coeficiente para el umbral de rozamiento
estático. La carga es |N|/(mg), no una evaluación de seguridad real.

RK4 usa pasos máximos de 0.002 s. Q se integra por trabajo, sin ajustar la
velocidad para forzar el balance. El error numérico se muestra en pantalla.

La llegada está en h = 0. En x = 46–74 m se aplica frenado constante hasta
la parada, integrado analíticamente. El rozamiento puede detener el carrito
antes dentro de esa zona. Q incluye ambas pérdidas; el CSV distingue
Q_rozamiento, Q_frenos y fuerza del freno. Sin rozamiento E_m se conserva
antes de frenar; E_m + Q se conserva durante el recorrido completo.

En modo familiar se usa una coordenada común para el primer carrito y
separaciones de 4.6 m. Cada carro conserva su propia posición y orientación.
La energía potencial se suma como Σm_i g h_i y la cinética como 1/2 M v².
La gravedad tangencial y el rozamiento se promedian por masa para integrar
la rapidez común. Las uniones son ideales y se omite la rotación de carros.
La altura mostrada corresponde al centro de masa; el control de altura fija
el punto de salida del primer carro. Los puntos A–G indican su paso. El
frenado empieza cuando el último carro entra en la recta de llegada. Cambiar
la distribución de masas puede cambiar la rapidez; multiplicar todas las
masas por un mismo factor conserva la rapidez y escala las energías.

Cada carrito tiene masa didáctica de 55 kg. Las masas iniciales de personajes
son editables y no son datos oficiales. La altura medida usa el punto del
riel como referencia.

## Comprobaciones

    node tests/physics.test.mjs
    node tests/family.test.mjs
    node tests/app-state.test.mjs
    node tests/assets.test.mjs
    node tests/motion.test.mjs
    node tests/hands.test.mjs
    node tests/clearance.test.mjs
    node tests/cart.test.mjs
    node tests/intro.test.mjs
    node tests/exports.test.mjs
    node --check dist/app.js

Se comprueban 27 combinaciones físicas, independencia respecto a masa,
conservación de energía, parada inferior y disipación. También se cargan los
activos, se comprueban las deformaciones animadas dentro del paso, la
geometría del carrito, estructuras en dieciocho casos individuales y familiares, intro y CSV.
No se realizó QA de navegador porque no está disponible la habilidad
control-browser en este entorno administrado.

## Fuentes

- OpenStax University Physics Volume 1, sección 8.3 Conservation of Energy:
  https://openstax.org/books/university-physics-volume-1/pages/8-3-conservation-of-energy
- OpenStax University Physics Volume 1, sección 6.3 Centripetal Force:
  https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force
- Three.js y complementos, versión 0.180.0, licencia MIT incluida.

Todos los archivos de ejecución están en dist y se sirven localmente,
sin servicios ni claves externas.

Intro background: higher-resolution official illustration (800 × 800), retrieved from https://www.universalstudioshollywood.com/tridiondata/ush/en/us/files/images/ush-simpsons-ride-universal-family-coaster-cf-b.jpg on 2026-10-18. The supplied 240 × 340 poster is retained as intro-family-background.png. The official artwork uses a closer composition; no generated reconstruction was used.
