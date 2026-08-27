import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const app = document.querySelector('#app');
const canvas = document.querySelector('#game');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf1c0c7, 0.018);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
const homePosition = new THREE.Vector3(7.4, 5.6, 8.8);
const homeTarget = new THREE.Vector3(0, 1.25, 0);
camera.position.copy(homePosition);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.copy(homeTarget);
controls.minDistance = 4.5;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.47;
controls.update();

function makeGradientMap(steps) {
  const size = Math.max(2, Number(steps));
  const data = new Uint8Array(size * 4);

  for (let i = 0; i < size; i += 1) {
    const value = Math.round(88 + (167 * i) / (size - 1));
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

let gradientMap = makeGradientMap(3);
const toonMaterial = new THREE.MeshToonMaterial({
  color: 0xffead2,
  gradientMap
});

const smoothMaterial = new THREE.MeshStandardMaterial({
  color: 0xffead2,
  roughness: 0.82,
  metalness: 0
});

const cubeGeometry = new THREE.BoxGeometry(3.2, 3.2, 3.2);
const cube = new THREE.Mesh(cubeGeometry, toonMaterial);
cube.position.y = 1.6;
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);

const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x070709,
  side: THREE.BackSide
});

const outlineCube = new THREE.Mesh(cubeGeometry, outlineMaterial);
outlineCube.position.copy(cube.position);
outlineCube.scale.setScalar(1.045);
scene.add(outlineCube);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshToonMaterial({
    color: 0xfff6e9,
    gradientMap: makeGradientMap(2)
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.015;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(40, 20, 0x161218, 0x302a2d);
grid.position.y = 0.01;
const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
gridMaterials.forEach((material) => {
  material.transparent = true;
  material.opacity = 0.78;
});
scene.add(grid);

const graphicShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(5.6, 2.4),
  new THREE.MeshBasicMaterial({
    color: 0x3b2f66,
    transparent: true,
    opacity: 0.64,
    depthWrite: false
  })
);
graphicShadow.rotation.x = -Math.PI / 2;
graphicShadow.rotation.z = -0.08;
graphicShadow.position.set(1.8, 0.025, -1.2);
scene.add(graphicShadow);

const keyLight = new THREE.DirectionalLight(0xfff0db, 2.5);
keyLight.position.set(-5, 10, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const ambientLight = new THREE.HemisphereLight(0xffe0e0, 0x4a3c67, 1.8);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0xded4ff, 1.4);
rimLight.position.set(7, 5, -7);
scene.add(rimLight);

const status = document.querySelector('#status');
function flash(message) {
  status.textContent = message;
  status.classList.add('show');
  clearTimeout(flash.timeout);
  flash.timeout = setTimeout(() => status.classList.remove('show'), 800);
}

function setBands(value) {
  gradientMap.dispose();
  gradientMap = makeGradientMap(value);
  toonMaterial.gradientMap = gradientMap;
  toonMaterial.needsUpdate = true;
}

document.querySelector('#cel').addEventListener('change', (event) => {
  cube.material = event.target.checked ? toonMaterial : smoothMaterial;
});

document.querySelector('#outline').addEventListener('change', (event) => {
  outlineCube.visible = event.target.checked;
});

document.querySelector('#bands').addEventListener('change', (event) => {
  setBands(event.target.value);
});

document.querySelector('#edge').addEventListener('input', (event) => {
  outlineCube.scale.setScalar(Number(event.target.value));
});

document.querySelector('#key').addEventListener('input', (event) => {
  keyLight.intensity = Number(event.target.value);
});

document.querySelector('#ambient').addEventListener('input', (event) => {
  ambientLight.intensity = Number(event.target.value);
});

document.querySelector('#rim').addEventListener('change', (event) => {
  rimLight.visible = event.target.checked;
});

function resetCamera() {
  camera.position.copy(homePosition);
  controls.target.copy(homeTarget);
  controls.update();
  flash('camera reset');
}

function toggleUI() {
  const selectors = '.panel,.jp-card,.logo,.version,.topbar';
  const elements = [...document.querySelectorAll(selectors)];
  const hidden = elements.some((element) => element.style.display !== 'none');
  elements.forEach((element) => {
    element.style.display = hidden ? 'none' : '';
  });
  flash(hidden ? 'UI hidden · press H' : 'UI restored');
}

app.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'r') resetCamera();
  if (key === 'h') toggleUI();
});
app.focus();

function resizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resizeRenderer);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
