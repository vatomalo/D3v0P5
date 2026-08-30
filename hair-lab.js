import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

let character=null, hairPivot=null, hairAsset=null, activeUrls=[];
const $=id=>document.getElementById(id);
const status=msg=>{const e=$('hair-status');if(e)e.textContent=msg;};
const clean=n=>(n||'').toLowerCase().replace(/^mixamorig[:_]?/,'').replace(/[^a-z0-9]/g,'');
const findHead=root=>{let head=null;root?.traverse?.(o=>{if(!head&&o.isBone&&clean(o.name)==='head')head=o});return head};
const rememberUrl=blob=>{const u=URL.createObjectURL(blob);activeUrls.push(u);return u};
const revokeUrls=()=>{activeUrls.forEach(URL.revokeObjectURL);activeUrls=[]};

function captureCharacter(obj){if(!obj||obj.userData?.ggHairAsset||obj.userData?.ggShaderOutline)return;const head=findHead(obj);if(head){character=obj;status(hairAsset?'HAIR ATTACHED · HEAD TRACKING':'HEAD FOUND · LOAD HAIR');}}
const sceneAdd=THREE.Scene.prototype.add;
THREE.Scene.prototype.add=function(...objs){const r=sceneAdd.apply(this,objs);objs.forEach(captureCharacter);return r};

function disposeHair(){if(hairPivot?.parent)hairPivot.parent.remove(hairPivot);hairPivot?.traverse(o=>{if(o.geometry)o.geometry.dispose?.();const mats=Array.isArray(o.material)?o.material:[o.material];mats.filter(Boolean).forEach(m=>m.dispose?.())});hairPivot=null;hairAsset=null;revokeUrls();status(character?'HEAD FOUND · LOAD HAIR':'WAITING FOR CHARACTER');}

function toonify(root){root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];o.material=mats.map(m=>{if(!m)return m;const n=m.clone();n.roughness=Math.max(.45,n.roughness??.7);n.metalness=Math.min(.25,n.metalness??0);n.side=THREE.DoubleSide;return n});if(o.material.length===1)o.material=o.material[0]});}

function fitToHead(root,name='HAIR'){const head=findHead(character);if(!head){status('NO HEAD BONE');return;}disposeHair();hairPivot=new THREE.Group();hairPivot.name='GG_HairPivot';hairPivot.userData.ggHairAsset=true;root.userData.ggHairAsset=true;hairAsset=root;toonify(root);
 root.updateMatrixWorld(true);const rawBox=new THREE.Box3().setFromObject(root),rawSize=rawBox.getSize(new THREE.Vector3()),rawCenter=rawBox.getCenter(new THREE.Vector3());
 root.position.sub(rawCenter);const charBox=new THREE.Box3().setFromObject(character),charSize=charBox.getSize(new THREE.Vector3());const targetH=Math.max(.001,charSize.y*.19),s=rawSize.y>1e-6?targetH/rawSize.y:1;
 root.scale.multiplyScalar(s);hairPivot.add(root);head.add(hairPivot);
 hairPivot.position.set(0,charSize.y*.055,0);hairPivot.rotation.set(0,0,0);hairPivot.scale.setScalar(1);syncUI();status(`${name} · ATTACHED TO HEAD`);window.ggHairLab?.focus?.();}

async function textureFromZip(zipFile){const blob=await zipFile.async('blob');const tex=await new THREE.TextureLoader().loadAsync(rememberUrl(blob));tex.colorSpace=THREE.SRGBColorSpace;tex.flipY=false;return tex;}
async function linearTextureFromZip(zipFile){const blob=await zipFile.async('blob');const tex=await new THREE.TextureLoader().loadAsync(rememberUrl(blob));tex.flipY=false;return tex;}
async function loadHairPack(file){status('OPENING .HP HAIRPACK...');const zip=await JSZip.loadAsync(file);const entries=Object.values(zip.files).filter(f=>!f.dir);const by=n=>entries.find(f=>n.test(f.name.toLowerCase()));const model=by(/\.(fbx|glb)$/);if(!model)throw new Error('Hairpack contains no FBX/GLB');
 const base=by(/(?:^|[_\-])(texture|basecolor|base_color|albedo|diffuse)\.png$/)||by(/texture\.png$/);const normal=by(/normal.*\.png$/),rough=by(/roughness.*\.png$/),metal=by(/metallic.*\.png$/);
 const modelBlob=await model.async('blob');let root;if(model.name.toLowerCase().endsWith('.glb'))root=(await new GLTFLoader().loadAsync(rememberUrl(modelBlob))).scene;else root=new FBXLoader().parse(await modelBlob.arrayBuffer(),'');
 const [map,nmap,rmap,mmap]=await Promise.all([base?textureFromZip(base):null,normal?linearTextureFromZip(normal):null,rough?linearTextureFromZip(rough):null,metal?linearTextureFromZip(metal):null]);
 root.traverse(o=>{if(!o.isMesh)return;const old=Array.isArray(o.material)?o.material[0]:o.material;const mat=new THREE.MeshStandardMaterial({color:0xffffff,map:map||old?.map||null,normalMap:nmap||null,roughnessMap:rmap||null,metalnessMap:mmap||null,roughness:.72,metalness:.04,side:THREE.DoubleSide,transparent:old?.transparent||false,alphaTest:old?.alphaTest||0});o.material=mat});
 fitToHead(root,file.name.replace(/\.(hp|zip)$/i,''));}

async function loadLoose(file){status(`LOADING ${file.name.toUpperCase()}...`);const url=rememberUrl(file);let root;if(/\.glb$/i.test(file.name))root=(await new GLTFLoader().loadAsync(url)).scene;else root=await new FBXLoader().loadAsync(url);fitToHead(root,file.name.replace(/\.[^.]+$/,''));}
async function loadFile(file){if(!file)return;try{if(/\.(hp|zip)$/i.test(file.name))await loadHairPack(file);else if(/\.(fbx|glb)$/i.test(file.name))await loadLoose(file);else status('USE .HP / .ZIP / .FBX / .GLB');}catch(e){console.error('[GG HAIR]',e);status(`HAIR LOAD FAILED · ${e.message}`);}}

function syncUI(){if(!hairPivot)return;const deg=THREE.MathUtils.radToDeg;const vals={ 'hair-x':hairPivot.position.x,'hair-y':hairPivot.position.y,'hair-z':hairPivot.position.z,'hair-rx':deg(hairPivot.rotation.x),'hair-ry':deg(hairPivot.rotation.y),'hair-rz':deg(hairPivot.rotation.z),'hair-scale':hairPivot.scale.x};Object.entries(vals).forEach(([id,v])=>{const e=$(id);if(e)e.value=v});}
function bindRange(id,fn){$(id)?.addEventListener('input',e=>{if(hairPivot)fn(Number(e.target.value))})}
function setup(){const input=$('hair-file');input?.addEventListener('change',e=>loadFile(e.target.files?.[0]));bindRange('hair-x',v=>hairPivot.position.x=v);bindRange('hair-y',v=>hairPivot.position.y=v);bindRange('hair-z',v=>hairPivot.position.z=v);bindRange('hair-rx',v=>hairPivot.rotation.x=THREE.MathUtils.degToRad(v));bindRange('hair-ry',v=>hairPivot.rotation.y=THREE.MathUtils.degToRad(v));bindRange('hair-rz',v=>hairPivot.rotation.z=THREE.MathUtils.degToRad(v));bindRange('hair-scale',v=>hairPivot.scale.setScalar(v));$('hair-remove')?.addEventListener('click',disposeHair);$('hair-reset')?.addEventListener('click',()=>{if(!hairPivot||!character)return;const h=new THREE.Box3().setFromObject(character).getSize(new THREE.Vector3()).y;hairPivot.position.set(0,h*.055,0);hairPivot.rotation.set(0,0,0);hairPivot.scale.setScalar(1);syncUI();status('HAIR FIT RESET')});status(character?'HEAD FOUND · LOAD HAIR':'WAITING FOR CHARACTER');}

window.ggHairLab={get character(){return character},get hair(){return hairPivot},loadFile,remove:disposeHair,focus(){document.querySelector('[data-workspace-tab="hair"]')?.click();},getFit(){return hairPivot?{position:hairPivot.position.toArray(),rotation:[hairPivot.rotation.x,hairPivot.rotation.y,hairPivot.rotation.z],scale:hairPivot.scale.x}:null}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
console.info('[GG HAIR] Head-bone Hair Lab armed · FBX/GLB/HP');