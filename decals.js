import * as THREE from 'three';

const FEATURE_DEFS = {
  eyes: {
    label: 'EYES',
    children: {
      left:  { label: 'LEFT',  x: -0.12, y: 0.075, scaleX: 0.11, scaleY: 0.055, rotation: 0, visible: true, variant: 'anime-01' },
      right: { label: 'RIGHT', x:  0.12, y: 0.075, scaleX: 0.11, scaleY: 0.055, rotation: 0, visible: true, variant: 'anime-01' }
    }
  },
  nose: {
    label: 'NOSE',
    children: {
      main: { label: 'MAIN', x: 0, y: -0.01, scaleX: 0.05, scaleY: 0.07, rotation: 0, visible: true, variant: 'line-01' }
    }
  },
  mouth: {
    label: 'MOUTH',
    children: {
      main: { label: 'MAIN', x: 0, y: -0.105, scaleX: 0.10, scaleY: 0.04, rotation: 0, visible: true, variant: 'neutral-01' }
    }
  }
};

function copyDefs() {
  return JSON.parse(JSON.stringify(FEATURE_DEFS));
}

function makeDecalTexture(feature, child) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#151119';
  ctx.fillStyle = '#151119';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (feature === 'eyes') {
    ctx.beginPath();
    ctx.moveTo(28, 72);
    ctx.quadraticCurveTo(128, 22, 228, 72);
    ctx.quadraticCurveTo(128, 112, 28, 72);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 70, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(136, 62, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (feature === 'nose') {
    ctx.beginPath();
    ctx.moveTo(118, 22);
    ctx.quadraticCurveTo(105, 72, 88, 93);
    ctx.quadraticCurveTo(118, 106, 152, 91);
    ctx.stroke();
  } else if (feature === 'mouth') {
    ctx.beginPath();
    ctx.moveTo(34, 64);
    ctx.quadraticCurveTo(128, 93, 222, 64);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.userData = { feature, child };
  return texture;
}

export class DecalSystem {
  constructor({ panel, featureSelect, childSelect, controls, flash }) {
    this.panel = panel;
    this.featureSelect = featureSelect;
    this.childSelect = childSelect;
    this.controls = controls;
    this.flash = flash;
    this.definition = copyDefs();
    this.group = new THREE.Group();
    this.group.name = 'FaceDecals';
    this.meshes = new Map();
    this.character = null;
    this.faceAnchor = { x: 0, y: 0, z: 0, width: 1, height: 1 };
    this.activeFeature = 'eyes';
    this.activeChild = 'left';
    this.bindUI();
    this.refreshChildOptions();
    this.syncUI();
  }

  attach(character) {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.character = character;
    if (!character) return;
    character.add(this.group);
    this.rebuild();
    this.updateFaceAnchor();
    this.updateAll();
    this.flash?.('DECALS ATTACHED');
  }

  updateFaceAnchor() {
    if (!this.character) return;
    const box = new THREE.Box3().setFromObject(this.character);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const worldPoint = new THREE.Vector3(center.x, box.max.y - size.y * 0.095, box.max.z + size.z * 0.008);
    this.character.worldToLocal(worldPoint);
    this.faceAnchor.x = worldPoint.x;
    this.faceAnchor.y = worldPoint.y;
    this.faceAnchor.z = worldPoint.z;
    this.faceAnchor.width = size.x * 0.17;
    this.faceAnchor.height = size.y * 0.12;
  }

  rebuild() {
    this.meshes.forEach((mesh) => {
      mesh.material.map?.dispose?.();
      mesh.material.dispose?.();
      mesh.geometry.dispose?.();
      mesh.parent?.remove(mesh);
    });
    this.meshes.clear();

    for (const [featureKey, feature] of Object.entries(this.definition)) {
      for (const childKey of Object.keys(feature.children)) {
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
          map: makeDecalTexture(featureKey, childKey),
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `decal:${featureKey}:${childKey}`;
        mesh.renderOrder = 50;
        this.group.add(mesh);
        this.meshes.set(`${featureKey}:${childKey}`, mesh);
      }
    }
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
        this.updateOne(this.activeFeature, this.activeChild);
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

  updateOne(featureKey, childKey) {
    const decal = this.definition[featureKey].children[childKey];
    const mesh = this.meshes.get(`${featureKey}:${childKey}`);
    if (!mesh || !decal) return;

    const sideBias = featureKey === 'eyes' ? 1 : 0.65;
    mesh.position.set(
      this.faceAnchor.x + decal.x * this.faceAnchor.width * 4.0,
      this.faceAnchor.y + decal.y * this.faceAnchor.height * 5.5,
      this.faceAnchor.z
    );
    mesh.scale.set(
      Math.max(0.002, decal.scaleX * this.faceAnchor.width * 7.0 * sideBias),
      Math.max(0.002, decal.scaleY * this.faceAnchor.height * 7.0),
      1
    );
    mesh.rotation.z = THREE.MathUtils.degToRad(decal.rotation);
    mesh.visible = decal.visible;
  }

  updateAll() {
    for (const [featureKey, feature] of Object.entries(this.definition)) {
      for (const childKey of Object.keys(feature.children)) this.updateOne(featureKey, childKey);
    }
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this.definition));
  }
}
