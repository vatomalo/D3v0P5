import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector('#stage');
const portraitCanvas = document.querySelector('#portrait');
const portraitCtx = portraitCanvas.getContext('2d');

const ui = {
  height: document.querySelector('#height'),
  shoulders: document.querySelector('#shoulders'),
  waist: document.querySelector('#waist'),
  head: document.querySelector('#head'),
  hair: document.querySelector('#hair'),
  skin: document.querySelector('#skin'),
  hairColor: document.querySelector('#hairColor'),
  shirtColor: document.querySelector('#shirtColor'),
  reset: document.querySelector('#reset'),
  blit: document.querySelector('#blit')
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc57fa5);
scene.fog = new THREE.Fog(0xc57fa5, 12, 26);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(4.8, 3.25, 7.1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 2.25, 0);
controls.minDistance = 4.2;
controls.maxDistance = 11;
controls.maxPolarAngle = Math.PI * 0.49;

function makeGradientMap() {
  const tex = new THREE.DataTexture(
    new Uint8Array([
      34,34,34,
      104,104,104,
      185,185,185,
      255,255,255
    ]),
    4,1,THREE.RGBFormat
  );
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

const gradientMap = makeGradientMap();

function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap });
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x111014, side: THREE.BackSide });
const body = new THREE.Group();
scene.add(body);

const parts = {};

function outlinedMesh(geometry, material, name) {
  const holder = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const outline = new THREE.Mesh(geometry, outlineMat);
  outline.scale.setScalar(1.055);
  holder.add(outline, mesh);
  holder.userData.mesh = mesh;
  holder.userData.outline = outline;
  if (name) parts[name] = holder;
  body.add(holder);
  return holder;
}

const skinMat = toon(0xd59a72);
const shirtMat = toon(0x1d1d26);
const pantsMat = toon(0x242330);
const shoeMat = toon(0x101014);
const hairMat = toon(0x111116);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x15131a });

outlinedMesh(new THREE.SphereGeometry(0.54, 32, 20), skinMat, 'head');
outlinedMesh(new THREE.SphereGeometry(0.585, 20, 12, 0, Math.PI*2, 0, Math.PI*0.56), hairMat, 'hairCap');
outlinedMesh(new THREE.ConeGeometry(0.16, 0.72, 5), hairMat, 'bangL');
outlinedMesh(new THREE.ConeGeometry(0.16, 0.8, 5), hairMat, 'bangR');
outlinedMesh(new THREE.BoxGeometry(1.45, 1.55, 0.62), shirtMat, 'torso');
outlinedMesh(new THREE.BoxGeometry(0.92, 0.58, 0.56), shirtMat, 'waist');
outlinedMesh(new THREE.CapsuleGeometry(0.18, 1.15, 6, 12), skinMat, 'armL');
outlinedMesh(new THREE.CapsuleGeometry(0.18, 1.15, 6, 12), skinMat, 'armR');
outlinedMesh(new THREE.CapsuleGeometry(0.22, 1.45, 6, 12), pantsMat, 'legL');
outlinedMesh(new THREE.CapsuleGeometry(0.22, 1.45, 6, 12), pantsMat, 'legR');
outlinedMesh(new THREE.BoxGeometry(0.46, 0.23, 0.8), shoeMat, 'shoeL');
outlinedMesh(new THREE.BoxGeometry(0.46, 0.23, 0.8), shoeMat, 'shoeR');

function addEye(x) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 8), eyeMat);
  eye.scale.set(1.6, 1, 0.45);
  eye.position.set(x, 3.92, 0.5);
  body.add(eye);
  return eye;
}
const eyeL = addEye(-0.17);
const eyeR = addEye(0.17);

function setPart(holder, pos, scale = [1,1,1], rot = [0,0,0]) {
  holder.position.set(...pos);
  holder.scale.set(...scale);
  holder.rotation.set(...rot);
}

function applyCharacter() {
  const height = Number(ui.height.value);
  const shoulder = Number(ui.shoulders.value);
  const waist = Number(ui.waist.value);
  const head = Number(ui.head.value);
  const hair = Number(ui.hair.value);

  skinMat.color.set(ui.skin.value);
  hairMat.color.set(ui.hairColor.value);
  shirtMat.color.set(ui.shirtColor.value);

  body.scale.set(1, height, 1);

  setPart(parts.head, [0, 3.9, 0], [head, head, head]);
  setPart(parts.hairCap, [0, 4.16, -0.015], [head*hair, head*hair, head*hair]);
  setPart(parts.bangL, [-0.2, 4.11, 0.47], [hair, hair, hair], [0.12, 0.08, 0.18]);
  setPart(parts.bangR, [0.19, 4.08, 0.49], [hair, hair*1.08, hair], [-0.06, -0.08, -0.22]);
  setPart(parts.torso, [0, 2.7, 0], [shoulder, 1, 1]);
  setPart(parts.waist, [0, 1.62, 0], [waist, 1, 1]);
  setPart(parts.armL, [-0.88*shoulder, 2.72, 0], [1,1,1], [0,0,-0.05]);
  setPart(parts.armR, [0.88*shoulder, 2.72, 0], [1,1,1], [0,0,0.05]);
  setPart(parts.legL, [-0.27, 0.72, 0], [1,1,1]);
  setPart(parts.legR, [0.27, 0.72, 0], [1,1,1]);
  setPart(parts.shoeL, [-0.27, 0.02, 0.18]);
  setPart(parts.shoeR, [0.27, 0.02, 0.18]);

  eyeL.position.set(-0.17*head, 3.92, 0.5*head);
  eyeR.position.set(0.17*head, 3.92, 0.5*head);
  eyeL.scale.set(1.6*head, head, 0.45*head);
  eyeR.scale.copy(eyeL.scale);
}

for (const el of [ui.height,ui.shoulders,ui.waist,ui.head,ui.hair,ui.skin,ui.hairColor,ui.shirtColor]) {
  el.addEventListener('input', applyCharacter);
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(24,24),
  new THREE.MeshToonMaterial({ color: 0xf2ead8, gradientMap })
);
floor.rotation.x = -Math.PI/2;
floor.position.y = -0.11;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(24, 24, 0x17141b, 0x756b78);
grid.position.y = -0.095;
scene.add(grid);

const hemi = new THREE.HemisphereLight(0xffefd7, 0x433956, 1.5);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe2c8, 4.2);
key.position.set(-5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -2;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9b8cff, 1.25);
rim.position.set(5,4,-5);
scene.add(rim);

function resetCharacter() {
  ui.height.value = '1';
  ui.shoulders.value = '1';
  ui.waist.value = '0.92';
  ui.head.value = '1';
  ui.hair.value = '1.05';
  ui.skin.value = '#d59a72';
  ui.hairColor.value = '#111116';
  ui.shirtColor.value = '#1d1d26';
  applyCharacter();
  camera.position.set(4.8,3.25,7.1);
  controls.target.set(0,2.25,0);
  controls.update();
}
ui.reset.addEventListener('click', resetCharacter);

function blitPortrait() {
  const oldPos = camera.position.clone();
  const oldTarget = controls.target.clone();

  camera.position.set(0, 3.25, 5.25);
  controls.target.set(0, 3.05, 0);
  camera.lookAt(controls.target);
  renderer.render(scene, camera);

  portraitCtx.clearRect(0,0,portraitCanvas.width,portraitCanvas.height);
  const src = renderer.domElement;
  const size = Math.min(src.width, src.height);
  const sx = (src.width - size) / 2;
  const sy = Math.max(0, (src.height - size) / 2 - size * 0.05);
  portraitCtx.drawImage(src, sx, sy, size, size, 0, 0, 512, 512);

  portraitCtx.strokeStyle = '#111014';
  portraitCtx.lineWidth = 14;
  portraitCtx.strokeRect(7,7,498,498);

  camera.position.copy(oldPos);
  controls.target.copy(oldTarget);
  camera.lookAt(controls.target);
  controls.update();
}
ui.blit.addEventListener('click', blitPortrait);

function resize() {
  const parent = canvas.parentElement;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

applyCharacter();
resize();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();
setTimeout(blitPortrait, 120);
