import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const roots=new Set();
function mats(v){return Array.isArray(v)?v:[v]}
function remember(root){if(root?.traverse)roots.add(root)}
function shiftMaterial(m){const u=m?.userData?.ggClothUniforms,axes=m?.userData?.ggClothAxes;if(!u?.ggClothMin||!u?.ggClothMax||!axes||m.userData.ggClothRaised)return false;const up=axes.upAxis,min=u.ggClothMin.value,max=u.ggClothMax.value,range=max.getComponent(up)-min.getComponent(up),d=range*.085;min.setComponent(up,min.getComponent(up)+d);max.setComponent(up,max.getComponent(up)+d);m.userData.ggClothRaised=true;return true}
function fix(root){let changed=0;root?.traverse?.(o=>{if(!o.isSkinnedMesh)return;for(const m of [...mats(o.material),...mats(o.userData?.originalMaterial),...mats(o.userData?.toonMaterial)])if(shiftMaterial(m))changed++});return changed}
const previous=FBXLoader.prototype.load;FBXLoader.prototype.load=function ggClothesFitCapture(url,onLoad,onProgress,onError){return previous.call(this,url,o=>{onLoad?.(o);if(!(typeof url==='string'&&/(?:^|\/)Anim\//i.test(url)))remember(o)},onProgress,onError)};
let announced=false;function tick(){for(const root of roots){const n=fix(root);if(n&&!announced){console.info('[GG CLOTHES FIT] Raised shader clothing mask on body.');announced=true}}requestAnimationFrame(tick)}requestAnimationFrame(tick);
console.info('[GG CLOTHES FIT] Vertical garment fit correction armed.');