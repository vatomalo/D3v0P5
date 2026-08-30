import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js';

// Garden Gaiden runtime FBX visual injector.
// FBX geometry, UVs, skeleton and skin weights remain untouched.
const TEXTURE_URLS = {
  male: './character-creator/base_color.jpg',
  female: './character-creator/base_color_f.jpg',
};
const texturePromises = new Map();

function loadRuntimeTexture(url) {
  if (texturePromises.has(url)) return texturePromises.get(url);
  const promise = new Promise((resolve) => {
    new THREE.TextureLoader().load(url,(texture)=>{texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;texture.needsUpdate=true;resolve(texture)},undefined,(error)=>{console.error('[GG FBX MATERIAL] Could not load',url,error);resolve(null)});
  });
  texturePromises.set(url,promise);return promise;
}
function textureUrlForFbx(url=''){const path=String(url).toLowerCase();const female=/basemodel\._f\.fbx(?:$|[?#])/i.test(path)||/basemodel_f\.fbx(?:$|[?#])/i.test(path);return female?TEXTURE_URLS.female:TEXTURE_URLS.male}
function makeRuntimeMaterial(source,texture){const src=source||{};return new THREE.MeshStandardMaterial({name:`${src.name||'FBX'}_GG_RUNTIME`,color:0xffffff,map:texture,roughness:Number.isFinite(src.roughness)?src.roughness:.82,metalness:Number.isFinite(src.metalness)?src.metalness:0,transparent:Boolean(src.transparent),opacity:Number.isFinite(src.opacity)?src.opacity:1,alphaTest:Number.isFinite(src.alphaTest)?src.alphaTest:0,side:src.side??THREE.FrontSide,depthTest:src.depthTest??true,depthWrite:src.depthWrite??true})}
function applyRuntimeMaterial(root,texture,textureUrl){let texturedMeshes=0,missingUvs=0;root.traverse((object)=>{if(!object.isMesh)return;if(!object.geometry?.attributes?.uv){missingUvs++;return}const oldMaterial=object.material;object.material=Array.isArray(oldMaterial)?oldMaterial.map((material)=>makeRuntimeMaterial(material,texture)):makeRuntimeMaterial(oldMaterial,texture);object.userData.ggRuntimeMaterial=true;object.userData.ggRuntimeTexture=textureUrl;texturedMeshes++});root.userData.ggRuntimeTextureApplied=texturedMeshes>0;root.userData.ggRuntimeTexture=textureUrl;root.userData.ggRuntimeTexturedMeshes=texturedMeshes;root.userData.ggRuntimeMissingUvs=missingUvs;console.info(`[GG FBX MATERIAL] ${textureUrl} applied to ${texturedMeshes} mesh(es)`+(missingUvs?` · ${missingUvs} mesh(es) had no UVs`:''))}

// Skinned outlines must themselves be SkinnedMesh objects. The old Character Lab
// outline deliberately skipped rigged meshes, which is why outlines disappeared
// when the Mixamo bases became the default models.
function installRiggedOutline(root){
  const additions=[];
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||mesh.userData.ggOutlineInstalled)return;
    const material=new THREE.MeshBasicMaterial({color:0x08080a,side:THREE.BackSide,skinning:true});
    const outline=new THREE.SkinnedMesh(mesh.geometry,material);
    outline.name=`${mesh.name||'SkinnedMesh'}_GG_OUTLINE`;
    outline.bindMode=mesh.bindMode;
    outline.bind(mesh.skeleton,mesh.bindMatrix);
    outline.position.copy(mesh.position);outline.quaternion.copy(mesh.quaternion);outline.scale.copy(mesh.scale).multiplyScalar(1.018);
    outline.frustumCulled=false;outline.renderOrder=-2;outline.userData.ggRiggedOutline=true;
    mesh.userData.ggOutlineInstalled=true;
    additions.push([mesh.parent,outline]);
  });
  additions.forEach(([parent,outline])=>parent?.add(outline));
  root.userData.ggRiggedOutlineCount=additions.length;
  console.info(`[GG OUTLINE] installed ${additions.length} skinned outline(s)`);
}

const originalLoad=FBXLoader.prototype.load;
FBXLoader.prototype.load=function patchedLoad(url,onLoad,onProgress,onError){const isAnimation=typeof url==='string'&&/(?:^|\/)Anim\//i.test(url);return originalLoad.call(this,url,async(object)=>{if(!isAnimation){const textureUrl=textureUrlForFbx(url);const texture=await loadRuntimeTexture(textureUrl);if(texture)applyRuntimeMaterial(object,texture,textureUrl);installRiggedOutline(object)}if(onLoad)onLoad(object)},onProgress,onError)};
console.info('[GG FBX MATERIAL] Runtime material + rigged outline injector armed.');
