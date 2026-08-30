import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const FEATURE_DEFS={eyes:{label:'EYES',children:{left:{label:'LEFT',x:-.115,y:.075,scaleX:.052,scaleY:.022,rotation:0,visible:true,variant:'anime-01'},right:{label:'RIGHT',x:.115,y:.075,scaleX:.052,scaleY:.022,rotation:0,visible:true,variant:'anime-01'}}},nose:{label:'NOSE',children:{main:{label:'MAIN',x:0,y:-.01,scaleX:.022,scaleY:.032,rotation:0,visible:true,variant:'line-01'}}},mouth:{label:'MOUTH',children:{main:{label:'MAIN',x:0,y:-.105,scaleX:.045,scaleY:.016,rotation:0,visible:true,variant:'neutral-01'}}}};
const copyDefs=()=>JSON.parse(JSON.stringify(FEATURE_DEFS));
let activeDecalSystem=null;

function drawEye(ctx,v){ctx.strokeStyle='#171119';ctx.fillStyle='#171119';ctx.lineWidth=v==='line-01'?11:14;ctx.lineCap='round';ctx.lineJoin='round';if(v==='line-01'){ctx.beginPath();ctx.moveTo(-58,4);ctx.quadraticCurveTo(0,-24,58,4);ctx.stroke();return}ctx.beginPath();ctx.moveTo(-60,4);ctx.quadraticCurveTo(0,-32,60,4);ctx.quadraticCurveTo(0,29,-60,4);ctx.stroke();ctx.beginPath();ctx.arc(0,3,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(7,-4,4.5,0,Math.PI*2);ctx.fill()}
function drawNose(ctx,v){ctx.strokeStyle='#171119';ctx.lineWidth=v==='anime-01'?9:11;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(6,-44);ctx.quadraticCurveTo(-4,2,-19,31);ctx.quadraticCurveTo(5,40,29,29);ctx.stroke()}
function drawMouth(ctx,v){ctx.strokeStyle='#171119';ctx.lineWidth=v==='anime-01'?10:12;ctx.lineCap='round';ctx.beginPath();if(v==='line-01'){ctx.moveTo(-54,0);ctx.lineTo(54,0)}else{ctx.moveTo(-58,-2);ctx.quadraticCurveTo(0,22,58,-2)}ctx.stroke()}
function asMaterials(value){return Array.isArray(value)?value:[value]}
function cleanBoneName(name=''){return name.toLowerCase().replace(/^mixamorig[:_]?/,'').replace(/[^a-z0-9]/g,'')}
function component(attribute,index,channel){return attribute.getComponent?attribute.getComponent(index,channel):channel===0?attribute.getX(index):channel===1?attribute.getY(index):channel===2?attribute.getZ(index):attribute.getW(index)}
function rectFromUvs(points,method){if(points.length<6)return null;let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity;for(const p of points){minU=Math.min(minU,p.u);maxU=Math.max(maxU,p.u);minV=Math.min(minV,p.v);maxV=Math.max(maxV,p.v)}if(!Number.isFinite(minU+minV+maxU+maxV))return null;const w=maxU-minU,h=maxV-minV;if(w<.0001||h<.0001)return null;const padU=w*.055,padV=h*.07;return{rect:new THREE.Vector4(minU-padU,minV-padV,w+padU*2,h+padV*2),count:points.length,method}}

function frontFaceUvFromHeadWeights(character,mesh){
 const geometry=mesh.geometry,uv=geometry?.attributes?.uv,pos=geometry?.attributes?.position,skinIndex=geometry?.attributes?.skinIndex,skinWeight=geometry?.attributes?.skinWeight,skeleton=mesh.skeleton;
 if(!uv||!pos||!skinIndex||!skinWeight||!skeleton?.bones?.length)return null;
 const headIndices=new Set();
 skeleton.bones.forEach((bone,index)=>{const n=cleanBoneName(bone.name);if(n==='head'||n==='headtopend')headIndices.add(index)});
 if(!headIndices.size)return null;
 character.updateMatrixWorld(true);mesh.updateMatrixWorld(true);
 const headBone=skeleton.bones.find(b=>cleanBoneName(b.name)==='head');
 const headWorld=headBone?.getWorldPosition(new THREE.Vector3())||new THREE.Box3().setFromObject(character).getCenter(new THREE.Vector3());
 const charBox=new THREE.Box3().setFromObject(character),charSize=charBox.getSize(new THREE.Vector3()),charCenter=charBox.getCenter(new THREE.Vector3());
 const samples=[],p=new THREE.Vector3(),world=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){
  let influence=0;
  for(let c=0;c<4;c++){const bi=component(skinIndex,i,c),w=component(skinWeight,i,c);if(headIndices.has(bi))influence+=w}
  if(influence<.34)continue;
  p.fromBufferAttribute(pos,i);if(mesh.isSkinnedMesh&&typeof mesh.applyBoneTransform==='function')mesh.applyBoneTransform(i,p);world.copy(p).applyMatrix4(mesh.matrixWorld);
  const u=uv.getX(i),v=uv.getY(i);if(!Number.isFinite(u)||!Number.isFinite(v))continue;
  samples.push({u,v,x:world.x,y:world.y,z:world.z,influence});
 }
 if(samples.length<12)return null;
 const xs=samples.map(s=>s.x).sort((a,b)=>a-b),ys=samples.map(s=>s.y).sort((a,b)=>a-b),zs=samples.map(s=>s.z).sort((a,b)=>a-b);
 const q=(arr,t)=>arr[Math.max(0,Math.min(arr.length-1,Math.floor((arr.length-1)*t)))];
 const xLo=q(xs,.16),xHi=q(xs,.84),yLo=q(ys,.16),yHi=q(ys,.82),zMid=q(zs,.48),zHi=q(zs,.98);
 const frontPlus=samples.filter(s=>s.x>=xLo&&s.x<=xHi&&s.y>=yLo&&s.y<=yHi&&s.z>=zMid);
 const frontMinus=samples.filter(s=>s.x>=xLo&&s.x<=xHi&&s.y>=yLo&&s.y<=yHi&&s.z<=q(zs,.52));
 const plusDepth=Math.abs(zHi-headWorld.z),minusDepth=Math.abs(q(zs,.02)-headWorld.z);
 let face=plusDepth>=minusDepth*.72?frontPlus:frontMinus;
 // Garden bases face +Z in the authoring viewport. Prefer that side when it has enough geometry.
 if(frontPlus.length>=Math.max(10,frontMinus.length*.55))face=frontPlus;
 // Remove the very top of the skull and low neck/jaw tail so the UV rect hugs the facial mask.
 const fy=face.map(s=>s.y).sort((a,b)=>a-b);if(fy.length>=12){const lo=q(fy,.08),hi=q(fy,.88);face=face.filter(s=>s.y>=lo&&s.y<=hi)}
 const result=rectFromUvs(face,'FRONT FACE · HEAD WEIGHTS');
 if(result){result.debug={samples:samples.length,head:[headWorld.x,headWorld.y,headWorld.z],characterCenter:[charCenter.x,charCenter.y,charCenter.z],characterSize:[charSize.x,charSize.y,charSize.z]}}
 return result;
}

function spatialFaceFallback(character,mesh){
 const pos=mesh.geometry?.attributes?.position,uv=mesh.geometry?.attributes?.uv;if(!pos||!uv)return null;
 character.updateMatrixWorld(true);mesh.updateWorldMatrix(true,false);
 const box=new THREE.Box3().setFromObject(character),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),faceY=box.max.y-size.y*.095,faceZ=center.z+size.z*.30,p=new THREE.Vector3(),world=new THREE.Vector3(),points=[];
 for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);if(mesh.isSkinnedMesh&&typeof mesh.applyBoneTransform==='function')mesh.applyBoneTransform(i,p);world.copy(p).applyMatrix4(mesh.matrixWorld);if(Math.abs(world.x-center.x)>size.x*.105||Math.abs(world.y-faceY)>size.y*.095||world.z<faceZ-size.z*.08)continue;const u=uv.getX(i),v=uv.getY(i);if(Number.isFinite(u)&&Number.isFinite(v))points.push({u,v})}
 return rectFromUvs(points,'FRONT FACE · SPATIAL');
}

function findFaceUvTarget(character){let best=null;character.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.ggShaderOutline||!mesh.geometry?.attributes?.uv)return;const weighted=mesh.isSkinnedMesh?frontFaceUvFromHeadWeights(character,mesh):null,result=weighted||spatialFaceFallback(character,mesh);if(!result)return;const score=result.count*(weighted?100:1);if(!best||score>best.score)best={mesh,rect:result.rect,count:result.count,method:result.method,score,debug:result.debug}});return best}

function patchMaterial(material,texture,rect){
 if(!material)return;material.userData=material.userData||{};
 if(material.userData.ggDecalShader){const u=material.userData.ggDecalUniforms;if(u){u.ggFaceDecal.value=texture;u.ggFaceUvRect.value.copy(rect)}return}
 material.userData.ggDecalShader=true;const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{previous?.(shader);shader.uniforms.ggFaceDecal={value:texture};shader.uniforms.ggFaceUvRect={value:rect.clone()};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 ggFaceUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nggFaceUv = uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D ggFaceDecal;\nuniform vec4 ggFaceUvRect;\nvarying vec2 ggFaceUv;').replace('#include <map_fragment>','#include <map_fragment>\nvec2 ggLocalUv=(ggFaceUv-ggFaceUvRect.xy)/ggFaceUvRect.zw;\nif(ggLocalUv.x>=0.0&&ggLocalUv.x<=1.0&&ggLocalUv.y>=0.0&&ggLocalUv.y<=1.0){vec4 ggDecal=texture2D(ggFaceDecal,ggLocalUv);diffuseColor.rgb=mix(diffuseColor.rgb,ggDecal.rgb,ggDecal.a);diffuseColor.a=max(diffuseColor.a,ggDecal.a);}');material.userData.ggDecalUniforms=shader.uniforms};
 const oldKey=material.customProgramCacheKey?.bind(material);material.customProgramCacheKey=()=>`${oldKey?oldKey():''}|gg-face-decals-v3`;material.needsUpdate=true;
}

export class DecalSystem{
 constructor({panel,featureSelect,childSelect,controls,flash}){this.panel=panel;this.featureSelect=featureSelect;this.childSelect=childSelect;this.controls=controls;this.flash=flash;this.definition=copyDefs();this.character=null;this.target=null;this.activeFeature='eyes';this.activeChild='left';this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=1024;this.ctx=this.canvas.getContext('2d');this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.anisotropy=4;this.texture.flipY=true;this.texture.needsUpdate=true;this.bindUI();this.refreshChildOptions();this.syncUI();this.redraw();activeDecalSystem=this}
 attach(character){this.character=character;if(!character)return;this.target=findFaceUvTarget(character);if(!this.target){console.warn('[GG DECALS] No face UV target found',character);this.flash?.('FACE SHADER TARGET NOT FOUND');return}const mesh=this.target.mesh,materials=[...asMaterials(mesh.material),...asMaterials(mesh.userData?.toonMaterial),...asMaterials(mesh.userData?.originalMaterial)];[...new Set(materials.filter(Boolean))].forEach(m=>patchMaterial(m,this.texture,this.target.rect));this.redraw();console.info('[GG DECALS] face shader target',{method:this.target.method,count:this.target.count,rect:this.target.rect.toArray(),debug:this.target.debug,mesh:mesh.name});this.flash?.(`FACE SHADER READY · ${this.target.method}`)}
 disposeOverlay(){}
 bindUI(){this.featureSelect.addEventListener('change',()=>{this.activeFeature=this.featureSelect.value;this.activeChild=Object.keys(this.definition[this.activeFeature].children)[0];this.refreshChildOptions();this.syncUI()});this.childSelect.addEventListener('change',()=>{this.activeChild=this.childSelect.value;this.syncUI()});for(const[key,input]of Object.entries(this.controls)){const event=input.type==='checkbox'||input.tagName==='SELECT'?'change':'input';input.addEventListener(event,()=>{const d=this.current();if(!d)return;if(key==='visible')d.visible=input.checked;else if(key==='variant')d.variant=input.value;else d[key]=Number(input.value);this.redraw()})}}
 refreshChildOptions(){const c=this.definition[this.activeFeature].children;this.childSelect.innerHTML=Object.entries(c).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');this.childSelect.value=this.activeChild}
 current(){return this.definition[this.activeFeature]?.children?.[this.activeChild]||null}
 syncUI(){const d=this.current();if(!d)return;this.featureSelect.value=this.activeFeature;this.childSelect.value=this.activeChild;for(const[k,i]of Object.entries(this.controls)){if(k==='visible')i.checked=d.visible;else if(k==='variant')i.value=d.variant;else i.value=d[k]}this.flash?.(`${this.definition[this.activeFeature].label} · ${d.label}`)}
 drawDecal(f,c,d){if(!d.visible)return;const ctx=this.ctx,x=512+d.x*1500,y=512-d.y*2050,sx=Math.max(.05,d.scaleX*34),sy=Math.max(.05,d.scaleY*64);ctx.save();ctx.translate(x,y);ctx.rotate(THREE.MathUtils.degToRad(d.rotation));ctx.scale(sx,sy);if(f==='eyes')drawEye(ctx,d.variant);else if(f==='nose')drawNose(ctx,d.variant);else if(f==='mouth')drawMouth(ctx,d.variant);ctx.restore()}
 redraw(){this.ctx.clearRect(0,0,1024,1024);for(const[f,feature]of Object.entries(this.definition))for(const[c,d]of Object.entries(feature.children))this.drawDecal(f,c,d);this.texture.needsUpdate=true}
 getFaceWorldPosition(target=new THREE.Vector3()){if(!this.character)return target.set(0,2,0);const head=this.character.getObjectByName('mixamorig:Head')||this.character.getObjectByName('mixamorigHead')||this.character.getObjectByName('Head');if(head)return head.getWorldPosition(target);const box=new THREE.Box3().setFromObject(this.character),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());return target.set(center.x,box.max.y-size.y*.095,center.z+size.z*.3)}
 updateOne(){this.redraw()}updateAll(){this.redraw()}toJSON(){return JSON.parse(JSON.stringify(this.definition))}
}

const previousLoad=FBXLoader.prototype.load;
FBXLoader.prototype.load=function ggDecalShaderAwareLoad(url,onLoad,onProgress,onError){const isAnimation=typeof url==='string'&&/(?:^|\/)Anim\//i.test(url);return previousLoad.call(this,url,(object)=>{onLoad?.(object);if(!isAnimation&&activeDecalSystem)requestAnimationFrame(()=>activeDecalSystem?.attach(object))},onProgress,onError)};
console.info('[GG DECALS] UV shader decal compositor v3 armed.');
