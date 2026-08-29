import * as THREE from 'three';

const FEATURE_DEFS = {
  eyes: {
    label: 'EYES',
    children: {
      left:  { label: 'LEFT',  x: -0.12, y: 0.075, scaleX: 0.052, scaleY: 0.022, rotation: 0, visible: true, variant: 'anime-01' },
      right: { label: 'RIGHT', x:  0.12, y: 0.075, scaleX: 0.052, scaleY: 0.022, rotation: 0, visible: true, variant: 'anime-01' }
    }
  },
  nose: {
    label: 'NOSE',
    children: {
      main: { label: 'MAIN', x: 0, y: -0.01, scaleX: 0.022, scaleY: 0.032, rotation: 0, visible: true, variant: 'line-01' }
    }
  },
  mouth: {
    label: 'MOUTH',
    children: {
      main: { label: 'MAIN', x: 0, y: -0.105, scaleX: 0.045, scaleY: 0.016, rotation: 0, visible: true, variant: 'neutral-01' }
    }
  }
};

function copyDefs() { return JSON.parse(JSON.stringify(FEATURE_DEFS)); }

function makeCurvedFaceGeometry(width, height, curve = 0.12) {
  const geometry = new THREE.PlaneGeometry(width, height, 24, 24);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const nx = x / (width * 0.5);
    const z = -curve * nx * nx;
    position.setZ(i, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function drawEye(ctx, variant) {
  ctx.strokeStyle = '#171119';
  ctx.fillStyle = '#171119';
  ctx.lineWidth = variant === 'line-01' ? 10 : 13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (variant === 'line-01') {
    ctx.beginPath();
    ctx.moveTo(-54, 4);
    ctx.quadraticCurveTo(0, -22, 54, 4);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(-56, 4);
  ctx.quadraticCurveTo(0, -30, 56, 4);
  ctx.quadraticCurveTo(0, 27, -56, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 3, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -3, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawNose(ctx, variant) {
  ctx.strokeStyle = '#171119';
  ctx.lineWidth = variant === 'anime-01' ? 8 : 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, -42);
  ctx.quadraticCurveTo(-4, 2, -18, 30);
  ctx.quadraticCurveTo(4, 38, 27, 28);
  ctx.stroke();
}

function drawMouth(ctx, variant) {
  ctx.strokeStyle = '#171119';
  ctx.lineWidth = variant === 'anime-01' ? 9 : 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (variant === 'line-01') {
    ctx.moveTo(-50, 0);
    ctx.lineTo(50, 0);
  } else {
    ctx.moveTo(-54, -2);
    ctx.quadraticCurveTo(0, 20, 54, -2);
  }
  ctx.stroke();
}

export class DecalSystem {
  constructor({ panel, featureSelect, childSelect, controls, flash }) {
    this.panel = panel;
    this.featureSelect = featureSelect;
    this.childSelect = childSelect;
    this.controls = controls;
    this.flash = flash;
    this.definition = copyDefs();
    this.character = null;
    this.overlay = null;
    this.faceAnchor = { x: 0, y: 0, z: 0, width: 1, height: 1, depth: 1 };
    this.activeFeature = 'eyes';
    this.activeChild = 'left';

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.needsUpdate = true;

    this.bindUI();
    this.refreshChildOptions();
    this.syncUI();
  }

  attach(character) {
    this.disposeOverlay();
    this.character = character;
    if (!character) return;
    this.updateFaceAnchor();
    this.buildOverlay();
    this.redraw();
    this.flash?.('FACE OVERLAY ATTACHED');
  }

  disposeOverlay() {
    if (!this.overlay) return;
    this.overlay.parent?.remove(this.overlay);
    this.overlay.geometry?.dispose?.();
    this.overlay.material?.dispose?.();
    this.overlay = null;
  }

  updateFaceAnchor() {
    if (!this.character) return;
    const box = new THREE.Box3().setFromObject(this.character);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const worldPoint = new THREE.Vector3(
      center.x,
      box.max.y - size.y * 0.105,
      box.max.z + size.z * 0.006
    );
    this.character.worldToLocal(worldPoint);
    this.faceAnchor.x = worldPoint.x;
    this.faceAnchor.y = worldPoint.y;
    this.faceAnchor.z = worldPoint.z;
    this.faceAnchor.width = size.x * 0.16;
    this.faceAnchor.height = size.y * 0.135;
    this.faceAnchor.depth = size.z;
  }

  buildOverlay() {
    const width = Math.max(0.2, this.faceAnchor.width * 2.0);
    const height = Math.max(0.28, this.faceAnchor.height * 2.15);
    const curve = Math.max(0.015, this.faceAnchor.depth * 0.035);
    const geometry = makeCurvedFaceGeometry(width, height, curve);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;

    this.overlay = new THREE.Mesh(geometry, material);
    this.overlay.name = 'FaceOverlay';
    this.overlay.position.set(this.faceAnchor.x, this.faceAnchor.y, this.faceAnchor.z);
    this.overlay.renderOrder = 60;
    this.character.add(this.overlay);
  }

  bindUI() {
    this.featureSelect.addEventListener('change', () => {
      this.activeFeature = this.featureSelect.value;
      this.activeChild = Object.keys(this.definition[this.activeFeature].children)[0];
      this.refreshChildOptions();
      this.syncUI();
    });
    this.childSelect.addEventListener('change', () => {
      this.activeChild = this.childSelect.value;
      this.syncUI();
    });
    for (const [key, input] of Object.entries(this.controls)) {
      const event = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(event, () => {
        const decal = this.current();
        if (!decal) return;
        if (key === 'visible') decal.visible = input.checked;
        else if (key === 'variant') decal.variant = input.value;
        else decal[key] = Number(input.value);
        this.redraw();
      });
    }
  }

  refreshChildOptions() {
    const children = this.definition[this.activeFeature].children;
    this.childSelect.innerHTML = Object.entries(children)
      .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
      .join('');
    this.childSelect.value = this.activeChild;
  }

  current() {
    return this.definition[this.activeFeature]?.children?.[this.activeChild] || null;
  }

  syncUI() {
    const decal = this.current();
    if (!decal) return;
    this.featureSelect.value = this.activeFeature;
    this.childSelect.value = this.activeChild;
    for (const [key, input] of Object.entries(this.controls)) {
      if (key === 'visible') input.checked = decal.visible;
      else if (key === 'variant') input.value = decal.variant;
      else input.value = decal[key];
    }
    this.flash?.(`${this.definition[this.activeFeature].label} · ${decal.label}`);
  }

  drawDecal(featureKey, childKey, decal) {
    if (!decal.visible) return;
    const ctx = this.ctx;
    const x = 256 + decal.x * 820;
    const y = 236 - decal.y * 1280;
    const sx = Math.max(0.05, decal.scaleX * 19.5);
    const sy = Math.max(0.05, decal.scaleY * 38.0);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(THREE.MathUtils.degToRad(decal.rotation));
    ctx.scale(sx, sy);

    if (featureKey === 'eyes') drawEye(ctx, decal.variant);
    else if (featureKey === 'nose') drawNose(ctx, decal.variant);
    else if (featureKey === 'mouth') drawMouth(ctx, decal.variant);

    ctx.restore();
  }

  redraw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const [featureKey, feature] of Object.entries(this.definition)) {
      for (const [childKey, decal] of Object.entries(feature.children)) {
        this.drawDecal(featureKey, childKey, decal);
      }
    }
    this.texture.needsUpdate = true;
  }

  updateOne() { this.redraw(); }
  updateAll() { this.redraw(); }
  toJSON() { return JSON.parse(JSON.stringify(this.definition)); }
}
