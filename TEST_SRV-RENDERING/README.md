# Three.js Render Server (Puppeteer)

Webservice Node.js qui génère une capture d'une scène 3D Three.js via Chromium headless.

**Conçu pour Windows-friendly** — pas de compilation native nécessaire.

## Installation

```bash
npm install
```

Au premier `npm install`, Puppeteer télécharge Chromium (~150 Mo).

## Préparer les textures

Place tes images dans `assets/`. Toutes les textures sont chargées **une seule fois au démarrage** et mises en cache mémoire.

```
assets/texture.png
assets/wood.jpg
assets/metal.png
```

Le nom de fichier (sans extension) sert d'identifiant à utiliser dans les requêtes (`"texture": "wood"`).

## Lancement

```bash
npm start
```

→ http://localhost:3000/render

## Architecture de mutualisation

Trois niveaux de cache pour maximiser la performance :

1. **Chromium** est lancé une seule fois au démarrage (`puppeteer.launch`)
2. **Pool de N pages** pré-initialisées avec Three.js et le `WebGLRenderer`. Chaque requête emprunte une page libre puis la rend
3. **Textures** chargées en base64 au démarrage côté Node, puis uploadées sur le GPU une seule fois par page (via `TextureLoader` dans `__loadTextures`). Les `THREE.Texture` restent en vie d'un rendu à l'autre

À chaque requête, on ne crée que la `Scene`, les meshes et la `Camera` — les textures et le renderer sont déjà chauds.

## API

### GET `/render`
Rendu par défaut (cube avec `assets/texture.png`).

### POST `/render`

```json
{
  "background": 2105392,
  "camera": {
    "position": [2.5, 2, 3],
    "lookAt": [0, 0, 0],
    "fov": 45
  },
  "objects": [
    {
      "geometry": "box",
      "size": [1, 1, 1],
      "position": [0, 0, 0],
      "rotation": [0.4, 0.7, 0],
      "texture": "texture"
    },
    {
      "geometry": "sphere",
      "radius": 0.5,
      "position": [1.5, 0, 0],
      "texture": "wood"
    }
  ]
}
```

Retourne une image PNG.

## Tuning

- `POOL_SIZE` (en haut de `server.js`) — nombre de pages concurrentes. 3 est un bon compromis. Augmenter si tu as beaucoup de RAM et de requêtes parallèles. Chaque page consomme ~50-100 Mo
- `WIDTH` / `HEIGHT` — résolution de sortie
- Sur certaines machines Windows / serveurs sans GPU, garde `--use-gl=swiftshader` (rendu logiciel, déjà configuré). Si tu as un vrai GPU disponible, retire-le pour de meilleures perfs

## Performance attendue

- Cold start : ~2-3s (Chromium + N pages init)
- Rendu d'une scène simple : 30-80ms
- Rendu d'une scène complexe : 100-300ms
