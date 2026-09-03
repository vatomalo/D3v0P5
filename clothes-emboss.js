import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const patched=new Set();
const $=id=>document.getElementById(id);
const state={enabled:true,pattern:1,depth:.16,scale:34};
const PATTERNS={0:'OFF',1:'RIBBED',2:'WOVEN',3:'QUILTED',4:'SEAMS'};

function ensureUI(){
  const page=document.querySelector('[data-workspace-page="clothes"]');
  if(!page||$('cloth-emboss'))return false;
  const anchor=$('cloth-neckline')?.closest('.row');
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div style="margin:10px 0 6px;border-top:1px solid #555;padding-top:8px;font:italic 700 11px Impact,sans-serif;letter-spacing:.8px">FABRIC RELIEF</div>
    <label class="row"><span>EMBOSS</span><input id="cloth-emboss" class="switch" type="checkbox" checked></label>
    <label class="row"><span>PATTERN</span><select id="cloth-emboss-pattern"><option value="0">OFF</option><option value="1" selected>RIBBED</option><option value="2">WOVEN</option><option value="3">QUILTED</option><option value="4">SEAMS</option></select></label>
    <label class="row"><span>DEPTH</span><input id="cloth-emboss-depth" type="range" min="0" max="0.45" step="0.01" value="0.16"></label>
    <label class="row"><span>SCALE</span><input id="cloth-emboss-scale" type="range" min="6" max="90" step="1" value="34"></label>`;
  const nodes=[...wrap.children];
  let ref=anchor?.nextSibling;
  for(const n of nodes)page.insertBefore(n,ref);
  $('cloth-emboss')?.addEventListener('change',e=>{state.enabled=e.target.checked;sync()});
  $('cloth-emboss-pattern')?.addEventListener('change',e=>{state.pattern=Number(e.target.value);sync()});
  $('cloth-emboss-depth')?.addEventListener('input',e=>{state.depth=Number(e.target.value);sync()});
  $('cloth-emboss-scale')?.addEventListener('input',e=>{state.scale=Number(e.target.value);sync()});
  return true;
}

function patchMaterial(m){
  if(!m?.userData?.ggShaderClothes||m.userData.ggClothEmboss)return false;
  m.userData.ggClothEmboss=true;
  const prev=m.onBeforeCompile;
  const oldKey=m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile=shader=>{
    prev?.(shader);
    shader.uniforms.ggEmbossEnabled={value:state.enabled?1:0};
    shader.uniforms.ggEmbossPattern={value:state.pattern};
    shader.uniforms.ggEmbossDepth={value:state.depth};
    shader.uniforms.ggEmbossScale={value:state.scale};
    m.userData.ggEmbossUniforms=shader.uniforms;
    shader.fragmentShader=shader.fragmentShader.replace(
      'uniform vec3 ggClothAxes;',
      'uniform vec3 ggClothAxes; uniform float ggEmbossEnabled; uniform int ggEmbossPattern; uniform float ggEmbossDepth; uniform float ggEmbossScale;'
    );
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>\nif(ggEmbossEnabled>0.5 && ggEmbossPattern>0 && ggClothPreset>0){\n  vec3 ggRaw=(ggClothRestPos-ggClothMin)/max(ggClothMax-ggClothMin,vec3(.00001));\n  int ggAx=int(ggClothAxes.x+.5),ggAy=int(ggClothAxes.y+.5);\n  float ggX=ggComp(ggRaw,ggAx),ggY=ggComp(ggRaw,ggAy);\n  float ggM=ggClothMask(ggClothRestPos)*ggClothOpacity;\n  float ggH=0.0;\n  if(ggEmbossPattern==1){ggH=sin(ggX*ggEmbossScale*6.28318);}\n  else if(ggEmbossPattern==2){ggH=.55*sin(ggX*ggEmbossScale*6.28318)+.45*sin(ggY*ggEmbossScale*6.28318);}\n  else if(ggEmbossPattern==3){ggH=sin((ggX+ggY)*ggEmbossScale*3.14159)*sin((ggX-ggY)*ggEmbossScale*3.14159);}\n  else if(ggEmbossPattern==4){float ggEdge=1.0-smoothstep(.0,.075,abs(ggM-.5));ggH=ggEdge*1.5-0.25;}\n  float ggRelief=ggH*ggEmbossDepth*ggM;\n  diffuseColor.rgb*=max(.35,1.0+ggRelief);\n}`
    );
  };
  m.customProgramCacheKey=()=>`${oldKey?oldKey():''}|gg-cloth-emboss-v1`;
  m.needsUpdate=true;
  patched.add(m);
  return true;
}

function patchRoot(root){let n=0;root?.traverse?.(o=>{if(!o.isSkinnedMesh)return;const all=[o.material,o.userData?.originalMaterial,o.userData?.toonMaterial].flat().filter(Boolean);for(const m of new Set(all))if(patchMaterial(m))n++});if(n)console.info('[GG EMBOSS] Patched',n,'clothing material(s).')}
function sync(){for(const m of patched){const u=m.userData?.ggEmbossUniforms;if(!u)continue;u.ggEmbossEnabled.value=state.enabled?1:0;u.ggEmbossPattern.value=state.pattern;u.ggEmbossDepth.value=state.depth;u.ggEmbossScale.value=state.scale}const s=$('cloth-status');if(s&&state.enabled&&state.pattern)s.textContent=`${s.textContent.split(' · EMBOSS')[0]} · EMBOSS ${PATTERNS[state.pattern]}`}

const previous=FBXLoader.prototype.load;
FBXLoader.prototype.load=function ggEmbossCapture(url,onLoad,onProgress,onError){return previous.call(this,url,o=>{onLoad?.(o);if(!(typeof url==='string'&&/(?:^|\/)Anim\//i.test(url)))requestAnimationFrame(()=>{ensureUI();patchRoot(o);sync()})},onProgress,onError)};

function tick(){ensureUI();requestAnimationFrame(tick)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(tick));else requestAnimationFrame(tick);
window.ggClothesEmboss={state,setEnabled(v){state.enabled=!!v;sync()},setPattern(v){state.pattern=Number(v)||0;sync()}};
console.info('[GG EMBOSS] Garment-only procedural fabric relief armed.');