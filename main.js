import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DecalSystem } from './decals.js';

const app = document.querySelector('#app');
const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const modelName = document.querySelector('#model-name');
const settings = document.querySelector('#settings');
const settingsToggle = document.querySelector('#settings-toggle');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf1c0c7, 0.018);
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
const homePosition = new THREE.Vector3(5.8, 3.4, 7.2);
const homeTarget = new THREE.Vector3(0, 1.6, 0);
camera.position.copy(homePosition);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.copy(homeTarget);
controls.minDistance = 2;
controls.maxDistance = 15;
controls.update();

function makeGradientMap(steps = 3) {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i += 1) {
    const v = Math.round(70 + (185 * i) / Math.max(1, steps - 1));
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

let gradientMap = makeGradientMap(3);
let character = null;
let sourceUrl = null;
const meshes = [];
const outlines = [];
const loader = new GLTFLoader();

const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshToonMaterial({ color: 0xfff6e9, gradientMap: makeGradientMap(2) }));
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

function flash(message, ms = 1200) {
  status.textContent = message;
  status.classList.add('show');
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => status.classList.remove('show'), ms);
}

const decalSystem = new DecalSystem({
  panel: document.querySelector('#decals'),
  featureSelect: document.querySelector('#decal-feature'),
  childSelect: document.querySelector('#decal-child'),
  controls: {
    visible: document.querySelector('#decal-visible'),
    x: document.querySelector('#decal-x'),
    y: document.querySelector('#decal-y'),
    scaleX: document.querySelector('#decal-scale-x'),
    scaleY: document.querySelector('#decal-scale-y'),
    rotation: document.querySelector('#decal-rotation'),
    variant: document.querySelector('#decal-variant')
  },
  flash
});
window.ggDecals = decalSystem;

function disposeCharacter() {
  if (character) scene.remove(character);
  outlines.splice(0).forEach((o) => { o.parent?.remove(o); o.material?.dispose?.(); });
  meshes.splice(0).forEach((mesh) => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => m?.dispose?.());
  });
  character = null;
}
function cloneToonMaterial(original) {
  return new THREE.MeshToonMaterial({ color: original?.color?.clone?.() || new THREE.Color(0xffffff), map: original?.map || null, normalMap: original?.normalMap || null, transparent: Boolean(original?.transparent), opacity: original?.opacity ?? 1, side: original?.side ?? THREE.FrontSide, gradientMap });
}
function buildOutline(mesh) {
  const material = new THREE.MeshBasicMaterial({ color: 0x08080a, side: THREE.BackSide });
  const outline = new THREE.Mesh(mesh.geometry, material);
  outline.position.copy(mesh.position); outline.quaternion.copy(mesh.quaternion);
  outline.scale.setScalar(Number(document.querySelector('#edge').value));
  outline.visible = document.querySelector('#outline').checked;
  outline.renderOrder = -1; mesh.parent.add(outline); outlines.push(outline);
}
function applyCelMode() { const enabled = document.querySelector('#cel').checked; meshes.forEach((mesh) => { mesh.material = enabled ? mesh.userData.toonMaterial : mesh.userData.originalMaterial; }); }
function rebuildToonMaterials() { meshes.forEach((mesh) => { mesh.userData.toonMaterial?.dispose?.(); mesh.userData.toonMaterial = cloneToonMaterial(mesh.userData.originalMaterial); }); applyCelMode(); }
function fitCharacter(root) {
  root.scale.setScalar(1); root.position.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(root); const size = box.getSize(new THREE.Vector3()); const targetHeight = 3.8;
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  const fitted = new THREE.Box3().setFromObject(root); const center = fitted.getCenter(new THREE.Vector3());
  root.position.x -= center.x; root.position.z -= center.z; root.position.y -= fitted.min.y;
  homeTarget.set(0, targetHeight * 0.52, 0); controls.target.copy(homeTarget); homePosition.set(5.6, 3.3, 7.4); camera.position.copy(homePosition); controls.update();
}
function installCharacter(gltf, label) {
  disposeCharacter(); character = gltf.scene; scene.add(character);
  character.traverse((object) => { if (!object.isMesh) return; object.castShadow = true; object.receiveShadow = true; object.userData.originalMaterial = object.material; object.userData.toonMaterial = cloneToonMaterial(object.material); meshes.push(object); });
  meshes.forEach(buildOutline); fitCharacter(character); applyCelMode(); decalSystem.attach(character); modelName.textContent = label.toUpperCase(); flash(`${label} · ${meshes.length} MESH${meshes.length === 1 ? '' : 'ES'} · LOADED`, 2200);
}
function loadUrl(url, label) { modelName.textContent = `LOADING ${label.toUpperCase()}...`; loader.load(url, (gltf) => installCharacter(gltf, label), undefined, (error) => { console.error(error); modelName.textContent = 'MODEL LOAD FAILED'; flash('MODEL LOAD FAILED', 3000); }); }

const modelFile = document.querySelector('#model-file');
modelFile.addEventListener('change', () => { const file = modelFile.files?.[0]; if (!file) return; if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = URL.createObjectURL(file); loadUrl(sourceUrl, file.name); });
loadUrl('./character-creator/Basemodel.glb', 'Basemodel.glb');

settingsToggle.addEventListener('click', () => {
  const collapsed = settings.classList.toggle('collapsed');
  settingsToggle.setAttribute('aria-expanded', String(!collapsed));
  settingsToggle.querySelector('.toggle-mark').textContent = collapsed ? '▶' : '◀';
  flash(collapsed ? 'CHARACTER VIEW HIDDEN' : 'CHARACTER VIEW OPEN');
});

const cel = document.querySelector('#cel'); cel.addEventListener('change', () => { applyCelMode(); flash(`CEL SHADING ${cel.checked ? 'ON' : 'OFF'}`); });
const outlineToggle = document.querySelector('#outline'); outlineToggle.addEventListener('change', () => { outlines.forEach((o) => { o.visible = outlineToggle.checked; }); flash(`OUTLINE ${outlineToggle.checked ? 'ON' : 'OFF'}`); });
const bands = document.querySelector('#bands'); bands.addEventListener('change', () => { gradientMap.dispose(); gradientMap = makeGradientMap(Number(bands.value)); rebuildToonMaterials(); flash(`${bands.value} SHADOW BANDS`); });
const edge = document.querySelector('#edge'); edge.addEventListener('input', () => { outlines.forEach((o) => o.scale.setScalar(Number(edge.value))); });
const key = document.querySelector('#key'); key.addEventListener('input', () => { keyLight.intensity = Number(key.value); });
const ambient = document.querySelector('#ambient'); ambient.addEventListener('input', () => { ambientLight.intensity = Number(ambient.value); });
const rim = document.querySelector('#rim'); rim.addEventListener('change', () => { rimLight.visible = rim.checked; flash(`RIM LIGHT ${rim.checked ? 'ON' : 'OFF'}`); });

function getAutoRenderScale() { const memory = navigator.deviceMemory || 4; const cores = navigator.hardwareConcurrency || 4; if (memory <= 2 || cores <= 4) return 0.5; if (memory <= 4 || cores <= 6) return 0.75; if (memory >= 8 && cores >= 12) return 1.25; return 1; }
let renderScaleMode = localStorage.getItem('gg-render-scale') || 'auto';
const renderScaleSelect = document.querySelector('#render-scale'); renderScaleSelect.value = [...renderScaleSelect.options].some((o) => o.value === renderScaleMode) ? renderScaleMode : 'auto'; renderScaleSelect.addEventListener('change', () => { renderScaleMode = renderScaleSelect.value; localStorage.setItem('gg-render-scale', renderScaleMode); resize(); });
function resolvedRenderScale() { return renderScaleMode === 'auto' ? getAutoRenderScale() : Number(renderScaleMode); }
function chooseUIProfile(width, height) { const aspect = width / Math.max(height, 1); const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; if (touch && width <= 900 && height > width) return 'phone-portrait'; if (touch && height <= 650) return 'phone-landscape'; if (width <= 900) return height > width ? 'phone-portrait' : 'phone-landscape'; if (width <= 1180 || height <= 720) return 'tablet'; if (width <= 1500 || height <= 850) return 'compact'; if (aspect >= 2.05 && width >= 1800) return 'ultrawide'; return 'desktop'; }
function adaptUI(width, height) { const profile = chooseUIProfile(width, height); app.dataset.uiProfile = profile; app.dataset.inputMode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer'; return profile; }
function resetCamera() { camera.position.copy(homePosition); controls.target.copy(homeTarget); controls.update(); flash('CAMERA RESET'); }
app.addEventListener('keydown', (event) => { if (event.target.matches('input,select,button')) return; const k = event.key.toLowerCase(); if (k === 'r') resetCamera(); if (k === 'h') document.querySelectorAll('.panel,.jp-card,.logo,.version,.topbar').forEach((el) => { el.hidden = !el.hidden; }); });
function resize() { const width = Math.max(1, app.clientWidth); const height = Math.max(1, app.clientHeight); const scale = resolvedRenderScale(); renderer.setSize(Math.round(width * scale), Math.round(height * scale), false); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; camera.aspect = width / height; camera.updateProjectionMatrix(); adaptUI(width, height); }
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 50)); resize();
(function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();