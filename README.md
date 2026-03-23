# Image Renamer AI

Renombra tus imagenes con nombres SEO usando inteligencia artificial (Google Gemini) y las convierte a WebP automaticamente.

Disponible como **app de escritorio** (Linux / Mac) o como **herramienta CLI**.

## Que hace

1. **Escanea** una carpeta con imagenes (PNG, JPG, TIFF, BMP, GIF, SVG, WebP)
2. **Analiza** cada imagen con Google Gemini para generar un nombre descriptivo y SEO-friendly en el idioma que elijas
3. **Convierte** las imagenes a WebP (excepto SVG, que se copian tal cual)
4. **Genera** un `mapping.json` con la correspondencia original -> nuevo nombre

### Ejemplo

```
IMG_20240315_001.jpg  ->  pan-rustico-masa-madre-corteza-dorada.webp
DSC_0042.png          ->  croissant-mantequilla-hojaldre-dorado.webp
logo.svg              ->  logo.svg (copiado sin cambios)
```

## Descarga

Ve a [**Releases**](../../releases) y descarga:

- **Linux**: `Image.Renamer.AI-x.x.x.AppImage` — abre directamente, sin instalar
- **Mac**: `Image.Renamer.AI-x.x.x.dmg` — arrastra a Aplicaciones

> Necesitas una API key de Gemini (gratis). Consiguela en [Google AI Studio](https://aistudio.google.com/apikey).

## App de escritorio

Abre la app, configura, y pulsa **Procesar**:

| Campo | Descripcion |
|-------|-------------|
| Carpeta de entrada | Carpeta con las imagenes originales |
| Carpeta de salida | Donde se guardan las imagenes procesadas |
| Gemini API Key | Tu clave de API (se guarda localmente) |
| Idioma | Idioma para los nombres generados (ej: "espanol de Espana", "English") |
| Contexto | Dominio de las imagenes (ej: "panaderia artesanal", "e-commerce", "blog de viajes") |
| Modelo | Modelo de Gemini a usar (`gemini-2.5-flash-lite` es gratis) |
| Concurrencia | Llamadas paralelas a la API (1-10) |
| RPM | Limite de peticiones por minuto (1-60) |
| Calidad WebP | Calidad de compresion (1-100) |

La app muestra progreso en tiempo real y un panel de logs. La configuracion se recuerda entre sesiones.

## CLI

Para usuarios avanzados o automatizacion:

### Requisitos

- Node.js 18+
- API key de Gemini en variable de entorno o `.env`

### Instalacion

```bash
git clone https://github.com/tu-usuario/image-renamer-ai.git
cd image-renamer-ai
npm install
```

### Configuracion

Crea un archivo `.env`:

```
GEMINI_API_KEY=tu_api_key_aqui
```

Opcionalmente, crea un `config.json` para valores por defecto:

```json
{
  "input": "./media",
  "output": "./processed",
  "language": "espanol de Espana",
  "context": "e-commerce",
  "model": "gemini-2.5-flash-lite",
  "concurrency": 3,
  "rpm": 15,
  "quality": 80
}
```

### Uso

```bash
# Procesar (escanear + analizar + convertir)
npm run process

# Solo analizar (ver nombres sin convertir)
npm run process:dry

# Solo analizar (guardar nombres en DB, no convertir)
npm run process:analyze

# Solo convertir (si ya analizaste antes)
npm run process:convert

# Borrar estado y empezar de cero
npm run process:reset
```

### Opciones CLI

```
--input <dir>       Carpeta de entrada
--output <dir>      Carpeta de salida
--model <model>     Modelo de Gemini
--language <lang>   Idioma para los nombres
--context <ctx>     Contexto/dominio de las imagenes
--concurrency <n>   Llamadas paralelas a la API
--rpm <n>           Limite de peticiones por minuto
--quality <n>       Calidad WebP (1-100)
--dry-run           Previsualizar nombres sin convertir
--analyze-only      Solo analizar
--convert-only      Solo convertir
--reset             Borrar estado
--verbose           Logs detallados
```

## Desarrollo

### Ejecutar la app Electron en modo desarrollo

```bash
npm run electron:dev
```

> En Linux puede requerir `--no-sandbox`: `npx electron . --no-sandbox`

### Generar ejecutables

```bash
npm run dist:linux    # .AppImage
npm run dist:mac      # .dmg
```

## Modelos disponibles

| Modelo | Precio |
|--------|--------|
| `gemini-2.5-flash-lite` | Gratis |
| `gemini-2.0-flash-lite` | $0.075 / 1M tokens input |
| `gemini-2.0-flash` | $0.10 / 1M tokens input |
| `gemini-2.5-flash` | $0.15 / 1M tokens input |
| `gemini-2.5-pro` | $1.25 / 1M tokens input |

## Tecnologias

- [Google Gemini](https://ai.google.dev/) — Vision AI para analisis de imagenes
- [Sharp](https://sharp.pixelplumbing.com/) — Conversion a WebP
- [Electron](https://www.electronjs.org/) — App de escritorio multiplataforma
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Estado persistente para reanudar procesamiento

## Licencia

MIT
