const app=document.querySelector('#app');
const canvas=document.querySelector('#compositor');
const ctx=canvas.getContext('2d');
const layerList=document.querySelector('#layer-list');
const loadInput=document.querySelector('#layer-file');
const previewToggle=document.querySelector('#composite-preview');
const transparentToggle=document.querySelector('#transparent-bg');
const xInput=document.querySelector('#layer-x');
const yInput=document.querySelector('#layer-y');
const scaleInput=document.querySelector('#layer-scale');
const opacityInput=document.querySelector('#layer-opacity');
const rotationInput=document.querySelector('#layer-rotation');
const layerName=document.querySelector('#layer-name');

let layers=[];
let selected=-1;
let nextId=1;

function captureApi(){return window.ggRenderCapture||null}
function fitCanvas(){const rect=app.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;draw()}}
function imageFromUrl(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
function addLayer(img,name,{scale=1,x=.5,y=.5,opacity=1,rotation=0}={}){layers.push({id:nextId++,img,name,x,y,scale,opacity,rotation});selected=layers.length-1;syncControls();renderLayerList();draw();setPreview(true)}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);for(const layer of layers){if(!layer.img?.naturalWidth)return;const iw=layer.img.naturalWidth,ih=layer.img.naturalHeight;const fit=Math.min(canvas.width/iw,canvas.height/ih);const w=iw*fit*layer.scale,h=ih*fit*layer.scale;ctx.save();ctx.globalAlpha=layer.opacity;ctx.translate(layer.x*canvas.width,layer.y*canvas.height);ctx.rotate(layer.rotation*Math.PI/180);ctx.drawImage(layer.img,-w/2,-h/2,w,h);ctx.restore()}}
function setPreview(enabled){previewToggle.checked=Boolean(enabled);app.classList.toggle('composition-preview',Boolean(enabled));canvas.hidden=!enabled;draw()}
function renderLayerList(){layerList.innerHTML='';[...layers].reverse().forEach((layer,reverseIndex)=>{const index=layers.length-1-reverseIndex;const button=document.createElement('button');button.type='button';button.className='layer-item'+(index===selected?' active':'');button.innerHTML=`<span>${index+1}</span><b>${layer.name}</b>`;button.addEventListener('click',()=>{selected=index;syncControls();renderLayerList()});layerList.appendChild(button)});if(!layers.length)layerList.innerHTML='<div class="layer-empty">NO LAYERS YET</div>'}
function current(){return layers[selected]||null}
function syncControls(){const l=current();const disabled=!l;[xInput,yInput,scaleInput,opacityInput,rotationInput].forEach(el=>el.disabled=disabled);layerName.textContent=l?l.name:'NO LAYER SELECTED';if(!l)return;xInput.value=Math.round(l.x*100);yInput.value=Math.round(l.y*100);scaleInput.value=Math.round(l.scale*100);opacityInput.value=Math.round(l.opacity*100);rotationInput.value=Math.round(l.rotation)}
function bindRange(input,key,convert){input.addEventListener('input',()=>{const l=current();if(!l)return;l[key]=convert(Number(input.value));draw()})}
bindRange(xInput,'x',v=>v/100);bindRange(yInput,'y',v=>v/100);bindRange(scaleInput,'scale',v=>v/100);bindRange(opacityInput,'opacity',v=>v/100);bindRange(rotationInput,'rotation',v=>v);

transparentToggle.addEventListener('change',()=>{captureApi()?.setTransparent(transparentToggle.checked)});
previewToggle.addEventListener('change',()=>setPreview(previewToggle.checked));

document.querySelector('#capture-scene').addEventListener('click',async()=>{const api=captureApi();if(!api)return;const img=await imageFromUrl(api.capture({transparent:false}));addLayer(img,`SCENE ${layers.length+1}`,{scale:1})});
document.querySelector('#capture-cutout').addEventListener('click',async()=>{const api=captureApi();if(!api)return;const img=await imageFromUrl(api.capture({transparent:true}));addLayer(img,`CUTOUT ${layers.length+1}`,{scale:1.28})});
loadInput.addEventListener('change',async()=>{const file=loadInput.files?.[0];if(!file)return;const url=URL.createObjectURL(file);try{const img=await imageFromUrl(url);addLayer(img,file.name,{scale:1})}finally{URL.revokeObjectURL(url);loadInput.value=''}});

document.querySelector('#layer-up').addEventListener('click',()=>{if(selected<0||selected>=layers.length-1)return;[layers[selected],layers[selected+1]]=[layers[selected+1],layers[selected]];selected++;renderLayerList();draw()});
document.querySelector('#layer-down').addEventListener('click',()=>{if(selected<=0)return;[layers[selected],layers[selected-1]]=[layers[selected-1],layers[selected]];selected--;renderLayerList();draw()});
document.querySelector('#layer-delete').addEventListener('click',()=>{if(selected<0)return;layers.splice(selected,1);selected=Math.min(selected,layers.length-1);syncControls();renderLayerList();draw()});
document.querySelector('#layer-clear').addEventListener('click',()=>{layers=[];selected=-1;syncControls();renderLayerList();draw()});
document.querySelector('#export-composite').addEventListener('click',()=>{draw();const a=document.createElement('a');a.download=`garden-gaiden-composite-${Date.now()}.png`;a.href=canvas.toDataURL('image/png');a.click()});

addEventListener('resize',fitCanvas);fitCanvas();renderLayerList();syncControls();setPreview(false);
window.ggComposition={get layers(){return layers},draw,show:()=>setPreview(true),hide:()=>setPreview(false)};
