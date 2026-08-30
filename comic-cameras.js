import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

// Garden Gaiden comic camera director.
// Captures Character Lab's OrbitControls + loaded character without changing the rig/model pipeline.
const state = { controls: null, character: null, roll: 0 };

const originalControlsUpdate = OrbitControls.prototype.update;
OrbitControls.prototype.update = function ggComicCameraUpdate(...args) {
  state.controls = this;
  const result = originalControlsUpdate.apply(this, args);
  if (state.roll) this.object.rotateZ(state.roll);
  return result;
};

const originalSceneAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function ggComicSceneAdd(...objects) {
  const result = originalSceneAdd.apply(this, objects);
  for (const object of objects) {
    if (!object?.isObject3D || object.isMesh || object.isLight || object.isLine || object.isLineSegments) continue;
    let meshes = 0, bones = 0;
    object.traverse?.(node => { if (node.isMesh) meshes++; if (node.isBone) bones++; });
    if (meshes > 0 || bones > 8) {
      state.character = object;
      setTimeout(() => applyPreset('body', false), 0);
    }
  }
  return result;
};

const PRESETS = {
  body:         { label:'FULL BODY',    y:.50, d:1.75, min:5.2, az:0,   el:.02, fov:45 },
  torso:        { label:'TORSO',        y:.70, d:1.02, min:3.2, az:0,   el:.02, fov:45 },
  face:         { label:'FACE',         head:true, yo:-.025, d:.48, min:1.65, az:0, el:.015, fov:45 },
  closeup:      { label:'CLOSE UP',     head:true, yo:-.035, d:.38, min:1.30, az:0, el:.01, fov:48 },
  extreme:      { label:'EXTREME CU',   head:true, yo:.005,  d:.25, min:.86, az:0, el:0, fov:52 },
  cowboy:       { label:'COWBOY',       y:.61, d:1.24, min:4.0, az:0,   el:.02, fov:42 },
  knees:        { label:'KNEE SHOT',    y:.56, d:1.42, min:4.5, az:0,   el:.015, fov:42 },
  threeleft:    { label:'3/4 LEFT',      y:.71, d:.82, min:2.65, az:-35, el:.03, fov:42 },
  threeright:   { label:'3/4 RIGHT',     y:.71, d:.82, min:2.65, az:35,  el:.03, fov:42 },
  profileleft:  { label:'PROFILE LEFT',  y:.72, d:.78, min:2.55, az:-90, el:.02, fov:44 },
  profileright: { label:'PROFILE RIGHT', y:.72, d:.78, min:2.55, az:90,  el:.02, fov:44 },
  backshot:     { label:'BACK SHOT',     y:.66, d:1.05, min:3.4, az:180, el:.02, fov:43 },
  lowhero:      { label:'LOW HERO',      y:.58, d:1.28, min:4.1, az:-18, el:-.18, fov:36 },
  worm:         { label:'WORM EYE',      y:.53, d:1.42, min:4.6, az:20,  el:-.32, fov:52 },
  highangle:    { label:'HIGH ANGLE',    y:.63, d:1.14, min:3.7, az:-20, el:.28, fov:45 },
  bird:         { label:'BIRD EYE',      y:.50, d:1.30, min:4.2, az:20,  el:.62, fov:50 },
  topdown:      { label:'TOP DOWN',      y:.48, d:.72, min:2.8, az:0,   el:1.18, fov:54 },
  dutchleft:    { label:'DUTCH LEFT',    y:.68, d:.92, min:3.0, az:-24, el:.03, roll:-12, fov:46 },
  dutchright:   { label:'DUTCH RIGHT',   y:.68, d:.92, min:3.0, az:24,  el:.03, roll:12, fov:46 },
  actionwide:   { label:'ACTION WIDE',   y:.53, d:2.02, min:6.4, az:-30, el:.10, fov:58 },
  shoulder:     { label:'OVER SHOULDER', y:.75, d:.73, min:2.35, az:150, el:.04, tx:.16, fov:48 },
  hero34:       { label:'HERO 3/4',      y:.58, d:1.34, min:4.25, az:-32, el:-.12, fov:35 },
  spaceleft:    { label:'SPACE LEFT',    y:.69, d:.94, min:3.1, az:-10, el:.03, tx:-.62, fov:43 },
  spaceright:   { label:'SPACE RIGHT',   y:.69, d:.94, min:3.1, az:10,  el:.03, tx:.62, fov:43 },
};

function headPosition(root) {
  const head = root?.getObjectByName('mixamorig:Head') || root?.getObjectByName('mixamorigHead') || root?.getObjectByName('Head');
  if (head) return head.getWorldPosition(new THREE.Vector3());
  return new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
}

function applyPreset(name, announce=true) {
  const root = state.character, controls = state.controls, preset = PRESETS[name];
  if (!root || !controls || !preset) return;

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  let target = preset.head ? headPosition(root) : new THREE.Vector3(center.x, box.min.y + size.y * preset.y, center.z);
  if (preset.yo) target.y += size.y * preset.yo;
  if (preset.tx) target.x += size.x * preset.tx;
  if (preset.tz) target.z += size.z * preset.tz;

  const distance = Math.max(preset.min || 0, size.y * preset.d);
  const az = THREE.MathUtils.degToRad(preset.az || 0);
  const camera = controls.object;
  state.roll = THREE.MathUtils.degToRad(preset.roll || 0);

  controls.target.copy(target);
  camera.fov = preset.fov || 45;
  camera.updateProjectionMatrix();
  camera.position.set(
    target.x + Math.sin(az) * distance,
    target.y + distance * (preset.el || 0),
    target.z + Math.cos(az) * distance
  );
  controls.update();

  if (announce) {
    const status = document.querySelector('#status');
    if (status) {
      status.textContent = `${preset.label} CAMERA`;
      status.classList.add('show');
      clearTimeout(applyPreset.timer);
      applyPreset.timer = setTimeout(() => status.classList.remove('show'), 1400);
    }
  }
}

// Capture phase prevents Character Lab's old 3-preset handler from treating new names as FULL BODY.
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-camera]');
  if (!button) return;
  const name = button.dataset.camera;
  if (!PRESETS[name]) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  applyPreset(name, true);
}, true);

document.addEventListener('keydown', event => {
  if (event.target?.matches?.('input,select,button')) return;
  const key = event.key.toLowerCase();
  if (key === 'r') {
    event.preventDefault(); event.stopImmediatePropagation(); applyPreset('body', true);
  } else if (key === 'f') {
    event.preventDefault(); event.stopImmediatePropagation(); applyPreset('face', true);
  }
}, true);

window.ggComicCamera = { applyPreset, presets: PRESETS };
console.info('[GG CAMERA] Comic camera director armed.');