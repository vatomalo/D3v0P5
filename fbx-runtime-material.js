import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js';

// Garden Gaiden runtime FBX material injector.
// The FBX keeps its original geometry, UVs, skeleton and skin weights.
// We only replace the render material before Character Lab installs the model.
const BASE_COLOR_URL = './character-creator/base_color.jpg';

const texturePromise = new Promise((resolve) => {
  new THREE.TextureLoader().load(
    BASE_COLOR_URL,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      resolve(texture);
    },
    undefined,
    (error) => {
      console.error('[GG FBX MATERIAL] Could not load', BASE_COLOR_URL, error);
      resolve(null);
    }
  );
});

function makeRuntimeMaterial(source, texture) {
  const src = source || {};
  return new THREE.MeshStandardMaterial({
    name: `${src.name || 'FBX'}_GG_RUNTIME`,
    color: 0xffffff,
    map: texture,
    roughness: Number.isFinite(src.roughness) ? src.roughness : 0.82,
    metalness: Number.isFinite(src.metalness) ? src.metalness : 0,
    transparent: Boolean(src.transparent),
    opacity: Number.isFinite(src.opacity) ? src.opacity : 1,
    alphaTest: Number.isFinite(src.alphaTest) ? src.alphaTest : 0,
    side: src.side ?? THREE.FrontSide,
    depthTest: src.depthTest ?? true,
    depthWrite: src.depthWrite ?? true,
  });
}

function applyRuntimeMaterial(root, texture) {
  let texturedMeshes = 0;
  let missingUvs = 0;

  root.traverse((object) => {
    if (!object.isMesh) return;

    if (!object.geometry?.attributes?.uv) {
      missingUvs++;
      return;
    }

    const oldMaterial = object.material;
    object.material = Array.isArray(oldMaterial)
      ? oldMaterial.map((material) => makeRuntimeMaterial(material, texture))
      : makeRuntimeMaterial(oldMaterial, texture);

    object.userData.ggRuntimeMaterial = true;
    texturedMeshes++;
  });

  root.userData.ggRuntimeTextureApplied = texturedMeshes > 0;
  root.userData.ggRuntimeTexturedMeshes = texturedMeshes;
  root.userData.ggRuntimeMissingUvs = missingUvs;

  console.info(
    `[GG FBX MATERIAL] base_color.jpg applied to ${texturedMeshes} mesh(es)` +
    (missingUvs ? ` · ${missingUvs} mesh(es) had no UVs` : '')
  );
}

// Patch FBXLoader before main.js creates its loader instance.
// Animation-only FBXs are left completely untouched.
const originalLoad = FBXLoader.prototype.load;
FBXLoader.prototype.load = function patchedLoad(url, onLoad, onProgress, onError) {
  const isAnimation = typeof url === 'string' && /(?:^|\/)Anim\//i.test(url);

  return originalLoad.call(
    this,
    url,
    async (object) => {
      if (!isAnimation) {
        const texture = await texturePromise;
        if (texture) applyRuntimeMaterial(object, texture);
      }
      if (onLoad) onLoad(object);
    },
    onProgress,
    onError
  );
};

console.info('[GG FBX MATERIAL] Runtime material injector armed.');
