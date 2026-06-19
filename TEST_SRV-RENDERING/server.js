// server.js
const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = 3000;
const WIDTH = 800;
const HEIGHT = 600;
const POOL_SIZE = 3; // nombre de pages Chromium concurrentes

// === État global mutualisé ===
let browser = null;
const pagePool = []; // pages disponibles
const waitQueue = []; // requêtes en attente d'une page libre
const textureCache = {}; // { name: "data:image/png;base64,..." }

// === Chargement des textures en mémoire au démarrage ===
function loadTextures() {
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.warn('⚠️  assets/ folder missing — no textures loaded');
    return;
  }

  const files = fs.readdirSync(assetsDir).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
  for (const file of files) {
    const buf = fs.readFileSync(path.join(assetsDir, file));
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    const name = path.basename(file, path.extname(file));
    textureCache[name] = `data:image/${mime};base64,${buf.toString('base64')}`;
    console.log(`  📦 texture loaded: ${name} (${(buf.length / 1024).toFixed(1)} KB)`);
  }
}

// === HTML hôte de la scène ===
// Three.js est chargé une fois par page, depuis un CDN.
// Les textures sont injectées via window.__TEXTURES__.
function getPageHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>body { margin: 0; background: transparent; }</style>
  <script type="importmap">
    { "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }
  </script>
</head>
<body>
  <canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>
  <script type="module">
    import * as THREE from 'three';
    window.THREE = THREE;

    // Décode toutes les textures fournies en data URL → THREE.Texture
    // une seule fois, puis les met à dispo dans window.__textures.
    window.__loadTextures = async (textureMap) => {
      const loader = new THREE.TextureLoader();
      const result = {};
      await Promise.all(Object.entries(textureMap).map(([name, dataUrl]) =>
        new Promise((resolve, reject) => {
          loader.load(dataUrl, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            result[name] = tex;
            resolve();
          }, undefined, reject);
        })
      ));
      window.__textures = result;
    };

    // Renderer partagé pour cette page (réutilisé entre les rendus)
    window.__renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('c'),
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    window.__renderer.setSize(${WIDTH}, ${HEIGHT}, false);
    window.__renderer.outputColorSpace = THREE.SRGBColorSpace;

    window.__ready = true;
  </script>
</body>
</html>`;
}

// === Initialisation d'une page : Three.js chargé, textures uploadées GPU ===
async function initPage(page) {
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  await page.setContent(getPageHTML(), { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true');
  await page.evaluate((textures) => window.__loadTextures(textures), textureCache);
}

// === Pool : récupérer une page libre, ou attendre ===
function acquirePage() {
  return new Promise((resolve) => {
    const page = pagePool.shift();
    if (page) return resolve(page);
    waitQueue.push(resolve);
  });
}

function releasePage(page) {
  const next = waitQueue.shift();
  if (next) next(page);
  else pagePool.push(page);
}

// === Rendu d'une scène 3D dans une page ===
// `sceneSpec` décrit ce qu'on veut afficher. C'est exécuté DANS la page Chromium.
async function renderScene(sceneSpec) {
  const page = await acquirePage();
  try {
    const screenshot = await page.evaluate(async (spec) => {
      const THREE = window.THREE;
      const renderer = window.__renderer;
      const textures = window.__textures;

      // Construction de la scène à partir de la spec
      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(
        spec.camera.fov ?? 45,
        spec.width / spec.height,
        0.1, 100
      );
      camera.position.set(...spec.camera.position);
      camera.lookAt(...(spec.camera.lookAt ?? [0, 0, 0]));

      // Lumières
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(5, 5, 5);
      scene.add(dir);

      // Objets : pour chaque objet de la spec, on lui associe une texture du cache
      for (const obj of spec.objects) {
        let geometry;
        if (obj.geometry === 'box') geometry = new THREE.BoxGeometry(...(obj.size ?? [1, 1, 1]));
        else if (obj.geometry === 'sphere') geometry = new THREE.SphereGeometry(obj.radius ?? 0.7, 32, 32);
        else geometry = new THREE.BoxGeometry(1, 1, 1);

        const material = new THREE.MeshStandardMaterial({
          map: obj.texture ? textures[obj.texture] : null,
          color: obj.color ?? 0xffffff,
          roughness: 0.5,
          metalness: 0.1,
        });

        const mesh = new THREE.Mesh(geometry, material);
        if (obj.position) mesh.position.set(...obj.position);
        if (obj.rotation) mesh.rotation.set(...obj.rotation);
        scene.add(mesh);
      }

      // Sol
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 5),
        new THREE.MeshStandardMaterial({ color: 0x666677 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.5;
      scene.add(floor);

      renderer.setClearColor(spec.background ?? 0x202030, 1);
      renderer.render(scene, camera);

      // Récupère le PNG depuis le canvas en data URL
      const dataUrl = renderer.domElement.toDataURL('image/png');

      // Cleanup mémoire (les géométries/matériaux de cette scène, PAS les textures)
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });

      return dataUrl;
    }, sceneSpec);

    // Conversion data URL → Buffer
    const base64 = screenshot.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64, 'base64');
  } finally {
    releasePage(page);
  }
}

// === Routes ===

// Rendu par défaut (cube texturé)
app.get('/render', async (req, res) => {
  try {
    const buffer = await renderScene({
      width: WIDTH,
      height: HEIGHT,
      background: 0x202030,
      camera: { position: [2.5, 2, 3], lookAt: [0, 0, 0] },
      objects: [
        {
          geometry: 'box',
          size: [1, 1, 1],
          position: [0, 0, 0],
          rotation: [0.4, Math.random(), 0],
          texture: 'texture', // → assets/texture.png
        },
      ],
    });
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error('Render error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Rendu personnalisé via POST { camera, objects, background }
app.post('/render', async (req, res) => {
  try {
    const spec = {
      width: WIDTH,
      height: HEIGHT,
      background: req.body.background ?? 0x202030,
      camera: req.body.camera ?? { position: [2.5, 2, 3], lookAt: [0, 0, 0] },
      objects: req.body.objects ?? [],
    };
    const buffer = await renderScene(spec);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error('Render error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Three.js Render Server (Puppeteer)</h1>
    <p>Textures disponibles : ${Object.keys(textureCache).join(', ') || '(aucune)'}</p>
    <p><a href="/render">/render</a> — rendu par défaut</p>
    <img src="/render" alt="3D render" />
  `);
});

// === Démarrage ===
async function start() {
  console.log('🚀 Loading textures...');
  loadTextures();

  console.log('🚀 Launching Chromium...');
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader'],
  });

  console.log(`🚀 Initializing ${POOL_SIZE} pages...`);
  for (let i = 0; i < POOL_SIZE; i++) {
    const page = await browser.newPage();
    await initPage(page);
    pagePool.push(page);
  }

  app.listen(PORT, () => {
    console.log(`✅ Server ready at http://localhost:${PORT}`);
  });
}

// Cleanup propre
async function shutdown() {
  console.log('\n🛑 Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
