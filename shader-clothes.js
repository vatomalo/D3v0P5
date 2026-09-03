import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let character=null;
const patchedMaterials=new Set();
const $=id=>document.getElementById(id);
const state={enabled:true,preset:1,color:new THREE.Color('#17151a'),opacity:1,length:0,neckline:0};

const PRESETS={
  0:'OFF',
  1:'TANK TOP',
  2:'T-SHIRT',
  3:'LONG SLEEVE',
  4:'CROP TOP',
  5:'DRESS BASE',
  6:'SHORTS',
  7:'LEGGINGS',
  8:'SKIRT BASE'
};

function status(msg){const el=$('cloth-status');if(el)el.textContent=msg}
function isCharacterRoot(root){let skinned=0,head=false;root?.traverse?.(o=>{if(o.isSkinnedMesh&&!o.userData?.ggShaderOutline)skinned++;if(o.isBone&&/^(?:mixamorig[:_]?)?head$/i.test(o.name||''))head=true});return skinned>0&&head}
function asArray(v){return Array.isArray(v)?v:[v]}

function ensureUI(){
  if($('cloth-preset'))return;
  const style=document.createElement('style');
  style.textContent=`
  .cloth-preset-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin:8px 0}
  .cloth-preset-grid button{background:#151515;color:#fff;border:1px solid #666;padding:7px 3px;font:italic 700 10px Impact,sans-serif;cursor:pointer}
  .cloth-preset-grid button:hover,.cloth-preset-grid button.active{background:var(--red);color:#080808;border-color:#fff}
  .cloth-color{width:100%;height:28px;background:#111;border:1px solid #666;padding:2px}
  .cloth-status{margin:7px 0;padding:7px;background:#0d0d0d;border-left:3px solid var(--red);color:#ccc;font:700 9px/1.35 Arial,sans-serif;letter-spacing:.65px}
  .cloth-note{margin-top:8px;color:#888;font:700 9px/1.35 Arial,sans-serif;letter-spacing:.55px}`;
  document.head.appendChild(style);

  const tabs=document.querySelector('.workspace-tabs');
  const renderTab=document.querySelector('[data-workspace-tab="render"]');
  if(tabs){
    const b=document.createElement('button');b.type='button';b.className='workspace-tab';b.dataset.workspaceTab='clothes';b.textContent='CLOTHES';
    tabs.insertBefore(b,renderTab||null);
    b.addEventListener('click',()=>{
      document.querySelectorAll('[data-workspace-tab]').forEach(x=>x.classList.toggle('active',x===b));
      document.querySelectorAll('[data-workspace-page]').forEach(x=>x.classList.toggle('active',x.dataset.workspacePage==='clothes'));
    });
  }
  const body=document.querySelector('.character-workspace .panel-body');
  if(body){
    const p=document.createElement('div');p.className='workspace-page';p.dataset.workspacePage='clothes';
    p.innerHTML=`<div class="workspace-heading">SHADER CLOTHES · SURFACE LAYER</div>
      <label class="row"><span>ENABLED</span><input id="cloth-enabled" class="switch" type="checkbox" checked></label>
      <label class="row"><span>GARMENT</span><select id="cloth-preset">${Object.entries(PRESETS).map(([k,v])=>`<option value="${k}"${k==='1'?' selected':''}>${v}</option>`).join('')}</select></label>
      <div class="cloth-preset-grid">${Object.entries(PRESETS).filter(([k])=>k!=='0').map(([k,v])=>`<button type="button" data-cloth-preset="${k}">${v}</button>`).join('')}</div>
      <label class="row"><span>COLOR</span><input id="cloth-color" class="cloth-color" type="color" value="#17151a"></label>
      <label class="row"><span>OPACITY</span><input id="cloth-opacity" type="range" min="0" max="1" step="0.01" value="1"></label>
      <label class="row"><span>LENGTH</span><input id="cloth-length" type="range" min="-0.15" max="0.18" step="0.005" value="0"></label>
      <label class="row"><span>NECKLINE</span><input id="cloth-neckline" type="range" min="-0.08" max="0.12" step="0.005" value="0"></label>
      <div id="cloth-status" class="cloth-status">WAITING FOR CHARACTER</div>
      <div class="cloth-note">PROCEDURAL SURFACE CLOTHING · FOLLOWS THE SKINNED BODY AUTOMATICALLY · SHELL MESHES COME NEXT FOR COATS / CLOAKS / SKIRTS / DRESSES.</div>`;
    const renderPage=document.querySelector('[data-workspace-page="render"]');
    body.insertBefore(p,renderPage||document.querySelector('[data-workspace-page="tools"]'));
  }
}

function shaderKey(material){const old=material.userData.ggClothOldCacheKey;return `${old?old():''}|gg-clothes-v1`}
function patchMaterial(material,mesh){
  if(!material||material.userData?.ggShaderClothes)return;
  material.userData=material.userData||{};
  material.userData.ggShaderClothes=true;
  material.userData.ggClothOldCacheKey=material.customProgramCacheKey?.bind(material);
  const prev=material.onBeforeCompile;
  const box=mesh.geometry.boundingBox||(()=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox})();
  const bmin=box?.min?.clone()||new THREE.Vector3(-1,-1,-1),bmax=box?.max?.clone()||new THREE.Vector3(1,1,1);
  material.onBeforeCompile=shader=>{
    prev?.(shader);
    shader.uniforms.ggClothEnabled={value:state.enabled?1:0};
    shader.uniforms.ggClothPreset={value:state.preset};
    shader.uniforms.ggClothColor={value:state.color.clone()};
    shader.uniforms.ggClothOpacity={value:state.opacity};
    shader.uniforms.ggClothLength={value:state.length};
    shader.uniforms.ggClothNeckline={value:state.neckline};
    shader.uniforms.ggClothMin={value:bmin};
    shader.uniforms.ggClothMax={value:bmax};
    material.userData.ggClothUniforms=shader.uniforms;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 ggClothRestPos;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nggClothRestPos = position;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\nvarying vec3 ggClothRestPos;\nuniform float ggClothEnabled; uniform int ggClothPreset; uniform vec3 ggClothColor; uniform float ggClothOpacity; uniform float ggClothLength; uniform float ggClothNeckline; uniform vec3 ggClothMin; uniform vec3 ggClothMax;\nfloat ggBand(float v,float lo,float hi,float feather){return smoothstep(lo,lo+feather,v)*(1.0-smoothstep(hi-feather,hi,v));}\nfloat ggBox2(vec2 p,vec2 lo,vec2 hi,float f){return ggBand(p.x,lo.x,hi.x,f)*ggBand(p.y,lo.y,hi.y,f);}\nfloat ggClothMask(vec3 rp){vec3 q=(rp-ggClothMin)/max(ggClothMax-ggClothMin,vec3(0.00001));float x=q.x,y=q.y;float torso=0.0,sleeves=0.0,legs=0.0,m=0.0;float L=ggClothLength;\nif(ggClothPreset==1){torso=ggBox2(vec2(x,y),vec2(.34,.46-L),vec2(.66,.765),.018);}\nelse if(ggClothPreset==2){torso=ggBox2(vec2(x,y),vec2(.31,.45-L),vec2(.69,.765),.018);sleeves=ggBox2(vec2(x,y),vec2(.18,.62),vec2(.82,.755),.018);}\nelse if(ggClothPreset==3){torso=ggBox2(vec2(x,y),vec2(.30,.44-L),vec2(.70,.765),.018);sleeves=ggBox2(vec2(x,y),vec2(.045,.43-L*.35),vec2(.955,.755),.018);}\nelse if(ggClothPreset==4){torso=ggBox2(vec2(x,y),vec2(.32,.585-L),vec2(.68,.765),.018);}\nelse if(ggClothPreset==5){torso=ggBox2(vec2(x,y),vec2(.29,.30-L),vec2(.71,.765),.018);}\nelse if(ggClothPreset==6){m=ggBand(y,.235-L,.435,.018);}\nelse if(ggClothPreset==7){m=ggBand(y,.035,.445+L,.018);}\nelse if(ggClothPreset==8){m=ggBand(y,.29-L,.455,.018);}\nm=max(m,max(torso,sleeves));\nif(ggClothPreset>=1&&ggClothPreset<=5){float nx=(x-.5)/(.075+ggClothNeckline*.20);float ny=(y-(.754-ggClothNeckline*.20))/(.052+max(0.0,ggClothNeckline)*.28);float neck=1.0-smoothstep(.78,1.08,nx*nx+ny*ny);m*=1.0-neck;}return clamp(m,0.0,1.0);}`)
      .replace('#include <map_fragment>','#include <map_fragment>\nif(ggClothEnabled>0.5 && ggClothPreset>0){float ggM=ggClothMask(ggClothRestPos)*ggClothOpacity;diffuseColor.rgb=mix(diffuseColor.rgb,ggClothColor,ggM);}');
  };
  material.customProgramCacheKey=()=>shaderKey(material);
  material.needsUpdate=true;
  patchedMaterials.add(material);
}

function syncUniforms(){
  for(const m of patchedMaterials){
    const u=m.userData?.ggClothUniforms;if(!u)continue;
    if(u.ggClothEnabled)u.ggClothEnabled.value=state.enabled?1:0;
    if(u.ggClothPreset)u.ggClothPreset.value=state.preset;
    if(u.ggClothColor)u.ggClothColor.value.copy(state.color);
    if(u.ggClothOpacity)u.ggClothOpacity.value=state.opacity;
    if(u.ggClothLength)u.ggClothLength.value=state.length;
    if(u.ggClothNeckline)u.ggClothNeckline.value=state.neckline;
  }
  document.querySelectorAll('[data-cloth-preset]').forEach(b=>b.classList.toggle('active',Number(b.dataset.clothPreset)===state.preset));
  status(character?`${PRESETS[state.preset]} · SHADER LAYER ${state.enabled?'ON':'OFF'}`:'WAITING FOR CHARACTER');
}

function install(root){
  if(!isCharacterRoot(root))return false;
  character=root;
  let count=0;
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||mesh.userData?.ggShaderOutline||mesh.userData?.ggHairAsset)return;
    const mats=[...asArray(mesh.material),...asArray(mesh.userData?.originalMaterial),...asArray(mesh.userData?.toonMaterial)];
    [...new Set(mats.filter(Boolean))].forEach(m=>patchMaterial(m,mesh));count++;
  });
  syncUniforms();
  status(`${PRESETS[state.preset]} · ${count} SKINNED BODY MESH${count===1?'':'ES'}`);
  console.info(`[GG CLOTHES] Shader clothes installed on ${count} skinned body mesh(es).`);
  return true;
}

function setup(){
  ensureUI();
  $('cloth-enabled')?.addEventListener('change',e=>{state.enabled=e.target.checked;syncUniforms()});
  $('cloth-preset')?.addEventListener('change',e=>{state.preset=Number(e.target.value);syncUniforms()});
  document.querySelectorAll('[data-cloth-preset]').forEach(b=>b.addEventListener('click',()=>{state.preset=Number(b.dataset.clothPreset);$('cloth-preset').value=String(state.preset);state.enabled=true;$('cloth-enabled').checked=true;syncUniforms()}));
  $('cloth-color')?.addEventListener('input',e=>{state.color.set(e.target.value);syncUniforms()});
  $('cloth-opacity')?.addEventListener('input',e=>{state.opacity=Number(e.target.value);syncUniforms()});
  $('cloth-length')?.addEventListener('input',e=>{state.length=Number(e.target.value);syncUniforms()});
  $('cloth-neckline')?.addEventListener('input',e=>{state.neckline=Number(e.target.value);syncUniforms()});
  document.querySelector('#bands')?.addEventListener('change',()=>requestAnimationFrame(()=>character&&install(character)));
}

const previousLoad=FBXLoader.prototype.load;
FBXLoader.prototype.load=function ggShaderClothesLoad(url,onLoad,onProgress,onError){
  const isAnimation=typeof url==='string'&&/(?:^|\/)Anim\//i.test(url);
  return previousLoad.call(this,url,object=>{onLoad?.(object);if(!isAnimation&&isCharacterRoot(object))requestAnimationFrame(()=>install(object))},onProgress,onError);
};

window.ggShaderClothes={install,setPreset(v){state.preset=Number(v)||0;syncUniforms()},setColor(v){state.color.set(v);syncUniforms()},setEnabled(v){state.enabled=Boolean(v);syncUniforms()},get state(){return{enabled:state.enabled,preset:state.preset,presetName:PRESETS[state.preset],color:`#${state.color.getHexString()}`,opacity:state.opacity,length:state.length,neckline:state.neckline}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
console.info('[GG CLOTHES] Procedural skinned shader clothing v1 armed.');