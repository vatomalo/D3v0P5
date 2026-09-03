import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const shaderOutlines=[];

function edgeWidth(){const edge=Number(document.querySelector('#edge')?.value||1.018);return Math.max(.002,(edge-1)*.36)}

function makeOutlineMaterial(){
  const material=new THREE.MeshBasicMaterial({color:0x08080a,side:THREE.BackSide,depthWrite:true,depthTest:true,toneMapped:false});
  material.userData.ggOutlineWidth=edgeWidth();
  material.onBeforeCompile=shader=>{
    shader.uniforms.ggOutlineWidth={value:material.userData.ggOutlineWidth};
    material.userData.ggOutlineUniform=shader.uniforms.ggOutlineWidth;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float ggOutlineWidth;').replace('#include <skinning_vertex>','#include <skinning_vertex>\ntransformed += normalize(objectNormal) * ggOutlineWidth;');
  };
  material.customProgramCacheKey=()=>`gg-skinned-outline-v1`;
  return material;
}

function addSkinnedOutline(mesh){
  if(!mesh?.isSkinnedMesh||mesh.userData.ggShaderOutlineBuilt||!mesh.parent)return null;
  mesh.userData.ggShaderOutlineBuilt=true;
  const material=makeOutlineMaterial();
  const outline=new THREE.SkinnedMesh(mesh.geometry,material);
  outline.name=`${mesh.name||'Mesh'}_GG_SHADER_OUTLINE`;
  outline.userData.ggShaderOutline=true;
  outline.position.copy(mesh.position);outline.quaternion.copy(mesh.quaternion);outline.scale.copy(mesh.scale);
  outline.bindMode=mesh.bindMode;
  outline.bind(mesh.skeleton,mesh.bindMatrix);
  outline.bindMatrixInverse.copy(mesh.bindMatrixInverse);
  outline.frustumCulled=false;
  outline.castShadow=false;outline.receiveShadow=false;
  outline.renderOrder=(mesh.renderOrder||0)-10;
  if(mesh.morphTargetInfluences)outline.morphTargetInfluences=mesh.morphTargetInfluences;
  mesh.parent.add(outline);
  shaderOutlines.push(outline);
  return outline;
}

function installOnRoot(root){
  if(!root||root.userData.ggShaderOutlinesReady)return;
  root.userData.ggShaderOutlinesReady=true;
  const added=[];
  root.traverse(o=>{if(o.isSkinnedMesh&&!o.userData.ggShaderOutline)added.push(addSkinnedOutline(o))});
  const enabled=document.querySelector('#outline')?.checked??true;
  added.filter(Boolean).forEach(o=>o.visible=enabled);
  console.info(`[GG OUTLINE] Shader outline attached to ${added.filter(Boolean).length} skinned mesh(es).`);
}

function syncWidth(){const width=edgeWidth();shaderOutlines.forEach(o=>{const m=o.material;if(!m)return;m.userData.ggOutlineWidth=width;if(m.userData.ggOutlineUniform)m.userData.ggOutlineUniform.value=width})}
function syncVisibility(){const visible=document.querySelector('#outline')?.checked??true;shaderOutlines.forEach(o=>o.visible=visible)}

document.querySelector('#edge')?.addEventListener('input',syncWidth);
document.querySelector('#outline')?.addEventListener('change',syncVisibility);

const previousLoad=FBXLoader.prototype.load;
FBXLoader.prototype.load=function ggShaderOutlineLoad(url,onLoad,onProgress,onError){
  const isAnimation=typeof url==='string'&&/(?:^|\/)Anim\//i.test(url);
  return previousLoad.call(this,url,(object)=>{onLoad?.(object);if(!isAnimation)requestAnimationFrame(()=>installOnRoot(object))},onProgress,onError)
};

window.ggShaderOutlines={refresh:syncWidth,toggle:syncVisibility,install:installOnRoot,get count(){return shaderOutlines.filter(o=>o.parent).length}};
console.info('[GG OUTLINE] Skinned normal-expansion shader armed.');