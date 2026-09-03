import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const roots=new Set();
function mats(v){return Array.isArray(v)?v:[v]}
function patchMaterial(m){
  if(!m||m.userData?.ggShoulderBridge)return false;
  const old=m.onBeforeCompile;if(!old)return false;
  m.onBeforeCompile=shader=>{
    old(shader);
    shader.fragmentShader=shader.fragmentShader
      .replace("torso=ggBox2(vec2(x,y),vec2(.31,.45-L),vec2(.69,.765),.018);sleeves=ggBox2(vec2(x,y),vec2(.18,.62),vec2(.82,.755),.018);","torso=ggBox2(vec2(x,y),vec2(.30,.45-L),vec2(.70,.765),.018);float shoulder=ggBox2(vec2(x,y),vec2(.20,.59),vec2(.80,.775),.018);sleeves=ggBox2(vec2(x,y),vec2(.10,.57),vec2(.90,.755),.018);torso=max(torso,shoulder);")
      .replace("torso=ggBox2(vec2(x,y),vec2(.30,.44-L),vec2(.70,.765),.018);sleeves=ggBox2(vec2(x,y),vec2(.045,.43-L*.35),vec2(.955,.755),.018);","torso=ggBox2(vec2(x,y),vec2(.29,.44-L),vec2(.71,.765),.018);float shoulder=ggBox2(vec2(x,y),vec2(.16,.56),vec2(.84,.775),.018);sleeves=ggBox2(vec2(x,y),vec2(.035,.40-L*.35),vec2(.965,.755),.018);torso=max(torso,shoulder);");
  };
  const oldKey=m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey=()=>`${oldKey?oldKey():''}|gg-shoulder-bridge-v1`;
  m.userData.ggShoulderBridge=true;m.needsUpdate=true;return true;
}
function fix(root){let n=0;root?.traverse?.(o=>{if(!o.isSkinnedMesh)return;for(const m of [...mats(o.material),...mats(o.userData?.originalMaterial),...mats(o.userData?.toonMaterial)])if(patchMaterial(m))n++});return n}
const previous=FBXLoader.prototype.load;FBXLoader.prototype.load=function ggShoulderCapture(url,onLoad,onProgress,onError){return previous.call(this,url,o=>{onLoad?.(o);if(!(typeof url==='string'&&/(?:^|\/)Anim\//i.test(url)))roots.add(o)},onProgress,onError)};
let announced=false;function tick(){for(const r of roots){const n=fix(r);if(n&&!announced){console.info('[GG CLOTHES] Shoulder bridge connected across torso and sleeves.');announced=true}}requestAnimationFrame(tick)}requestAnimationFrame(tick);
console.info('[GG CLOTHES] Shoulder continuity fix armed.');