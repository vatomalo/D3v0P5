import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const app = document.querySelector('#app');
const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf1c0c7, 0.018);
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
const homePosition = new THREE.Vector3(5.8, 3.4, 7.2);
const homeTarget = new THREE.Vector3(0, 1.25, 0);
camera.position.copy(homePosition);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.copy(homeTarget);
controls.minDistance = 2.5;
controls.maxDistance = 15;
controls.update();

function makeGradientMap(steps = 3) {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i += 1) {
    const v = Math.round(90 + (165 * i) / (steps - 1));
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

let gradientMap = makeGradientMap(3);
const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.BackSide });
let character = null;
const outlines = [];

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshToonMaterial({ color: 0xfff6e9, gradientMap: makeGradientMap(2) })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(40, 20, 0x161218, 0x302a2d);
grid.position.y = 0.01;
scene.add(grid);

const keyLight = new THREE.DirectionalLight(0xfff0db, 2.5);
keyLight.position.set(-5, 10, 6);
keyLight.castShadow = true;
scene.add(keyLight);

const ambientLight = new THREE.HemisphereLight(0xffe0e0, 0x4a3c67, 1.8);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0xded4ff, 1.4);
rimLight.position.set(7, 5, -7);
scene.add(rimLight);

function fitCharacter(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const targetHeight = 3.4;
  const scale = targetHeight / Math.max(size.y, 0.001);
  root.scale.setScalar(scale);
  const b2 = new THREE.Box3().setFromObject(root);
  b2.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= b2.min.y;
  controls.target.set(0, targetHeight * 0.52, 0);
  homeTarget.copy(controls.target);
}

function addOutline(mesh) {
  const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
  outline.scale.setScalar(1.018);
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.quaternion.copy(mesh.quaternion);
  outline.userData.source = mesh;
  mesh.parent.add(outline);
  outlines.push(outline);
}

const loader = new GLTFLoader();
loader.load(
  './assets/runtime/characters/human_base_m_v1.glb',
  (gltf) => {
    character = gltf.scene;
    character.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        addOutline(object);
      }
    });
    scene.add(character);
    fitCharacter(character);
    status.textContent = 'BASE BODY v1 · LOADED';
  },
  undefined,
  (error) => {
    console.error('Base model missing:', error);
    status.textContent = 'DROP human_base_m_v1.glb INTO assets/runtime/characters/';
  }
);

const cel = document.querySelector('#cel');
if (cel) cel.addEventListener('change', (event) => {
  if (!character) return;
  character.traverse((object) => {
    if (object.isMesh && !object.userData.source && event.target.checked) {
      const old = object.material;
      object.material = new THREE.MeshToonMaterial({
        map: old.map || null,
        color: old.color || 0xffffff,
        gradientMap
      });
    }
  });
});

const outline = document.querySelector('#outline');
if (outline) outline.addEventListener('change', (event) => outlines.forEach((object) => { object.visible = event.target.checked; }));
const edge = document.querySelector('#edge');
if (edge) edge.addEventListener('input', (event) => outlines.forEach((object) => object.scale.setScalar(Number(event.target.value))));
const key = document.querySelector('#key');
if (key) key.addEventListener('input', (event) => { keyLight.intensity = Number(event.target.value); });
const ambient = document.querySelector('#ambient');
if (ambient) ambient.addEventListener('input', (event) => { ambientLight.intensity = Number(event.target.value); });
const rim = document.querySelector('#rim');
if (rim) rim.addEventListener('change', (event) => { rimLight.visible = event.target.checked; });

function getAutoRenderScale() {
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (memory <= 2 || cores <= 4) return 0.5;
  if (memory <= 4 || cores <= 6) return 0.75;
  if (memory >= 8 && cores >= 12) return 1.25;
  return 1;
}

let renderScaleMode = localStorage.getItem('gg-render-scale') || 'auto';
const renderScaleSelect = document.querySelector('#render-scale');
if (renderScaleSelect) {
  renderScaleSelect.value = [...renderScaleSelect.options].some((option) => option.value === renderScaleMode)
    ? renderScaleMode
    : 'auto';
  renderScaleSelect.addEventListener('change', (event) => {
    renderScaleMode = event.target.value;
    localStorage.setItem('gg-render-scale', renderScaleMode);
    resize();
  });
}

function resolvedRenderScale() {
  return renderScaleMode === 'auto' ? getAutoRenderScale() : Number(renderScaleMode);
}

function chooseUIProfile(width, height) {
  const aspect = width / Math.max(height, 1);
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (touch && width <= 900 && height > width) return 'phone-portrait';
  if (touch && height <= 650) return 'phone-landscape';
  if (width <= 900) return height > width ? 'phone-portrait' : 'phone-landscape';
  if (width <= 1180 || height <= 720) return 'tablet';
  if (width <= 1500 || height <= 850) return 'compact';
  if (aspect >= 2.05 && width >= 1800) return 'ultrawide';
  return 'desktop';
}

function adaptUI(width, height) {
  const profile = chooseUIProfile(width, height);
  app.dataset.uiProfile = profile;
  app.dataset.inputMode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer';
  return profile;
}

function resetCamera() {
  camera.position.copy(homePosition);
  controls.target.copy(homeTarget);
  controls.update();
}

app.addEventListener('keydown', (event) => {
  const keyName = event.key.toLowerCase();
  if (keyName === 'r') resetCamera();
  if (keyName === 'h') {
    document.querySelectorAll('.panel,.jp-card,.logo,.version,.topbar').forEach((element) => {
      element.hidden = !element.hidden;
    });
  }
});
app.focus();

function resize() {
  const width = Math.max(1, app.clientWidth);
  const height = Math.max(1, app.clientHeight);
  const renderScale = resolvedRenderScale();
  const internalWidth = Math.max(1, Math.round(width * renderScale));
  const internalHeight = Math.max(1, Math.round(height * renderScale));

  renderer.setSize(internalWidth, internalHeight, false);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const profile = adaptUI(width, height);
  status.textContent = `${profile.toUpperCase()} · ${renderScaleMode === 'auto' ? 'AUTO ' : ''}${Math.round(renderScale * 100)}% · ${internalWidth}×${internalHeight} → ${width}×${height}`;
  status.classList.add('show');
  clearTimeout(resize.statusTimer);
  resize.statusTimer = setTimeout(() => status.classList.remove('show'), 1200);
}

addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 50));
resize();

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();
