import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector('#game');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd8d0bf);
scene.fog = new THREE.Fog(0xd8d0bf, 14, 28);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(6.2, 4.3, 7.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1.0, 0);
controls.minDistance = 3.2;
controls.maxDistance = 13;
controls.maxPolarAngle = Math.PI * 0.48;

// Hard stepped light bands. This is the core of the anime/cel-shaded look.
const gradientMap = new THREE.DataTexture(
  new Uint8Array([
    28, 28, 28,
    105, 105, 105,
    190, 190, 190,
    255, 255, 255
  ]),
  4,
  1,
  THREE.RGBFormat
);
gradientMap.needsUpdate = true;
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;

const toonMaterial = new THREE.MeshToonMaterial({
  color: 0xd84d39,
  gradientMap
});

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(2.25, 2.25, 2.25),
  toonMaterial
);
cube.position.y = 1.4;
cube.rotation.set(-0.03, 0.48, -0.04);
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);

// Manga outline trick: render an enlarged, back-faced black copy behind the mesh.
const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x111111,
  side: THREE.BackSide
});

const outlineCube = new THREE.Mesh(cube.geometry, outlineMaterial);
outlineCube.position.copy(cube.position);
outlineCube.rotation.copy(cube.rotation);
outlineCube.scale.setScalar(1.055);
scene.add(outlineCube);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(28, 28),
  new THREE.MeshToonMaterial({
    color: 0xeee6d5,
    gradientMap
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Graphic ground markings hint at the eventual manga/urban visual language.
const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x191919 });
const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.6, 2.72, 64),
  ringMaterial
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.012;
scene.add(ring);

const slash = new THREE.Mesh(
  new THREE.PlaneGeometry(5.6, 0.16),
  new THREE.MeshBasicMaterial({ color: 0x191919 })
);
slash.rotation.x = -Math.PI / 2;
slash.rotation.z = -0.38;
slash.position.set(0.2, 0.016, 0.05);
scene.add(slash);

const hemi = new THREE.HemisphereLight(0xfff1d2, 0x46516a, 1.35);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff0d0, 4.1);
key.position.set(-4.5, 7.5, 4.0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 25;
key.shadow.camera.left = -7;
key.shadow.camera.right = 7;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -7;
key.shadow.bias = -0.0004;
scene.add(key);

const rim = new THREE.DirectionalLight(0x809dff, 1.15);
rim.position.set(5, 3, -4);
scene.add(rim);

function resizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resizeRenderer);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  // Barely perceptible motion keeps the test object alive without turning it into a demo toy.
  cube.position.y = 1.4 + Math.sin(t * 1.15) * 0.035;
  outlineCube.position.y = cube.position.y;

  controls.update();
  renderer.render(scene, camera);
}

animate();
