import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const app = document.querySelector('#app');
const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf1c0c7, 0.018);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
const homePosition = new THREE.Vector3(5.8, 3.4, 7.2);
const homeTarget = new THREE.Vector3(0, 1.25, 0);
camera.position.copy(homePosition);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.copy(homeTarget);
controls.minDistance = 2.5;
controls.maxDistance = 15;
controls.update();

function makeGradientMap(steps=3){const data=new Uint8Array(steps*4);for(let i=0;i<steps;i++){const v=Math.round(90+165*i/(steps-1));data.set([v,v,v,255],i*4)}const t=new THREE.DataTexture(data,steps,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t}
let gradientMap=makeGradientMap(3);
const outlineMaterial=new THREE.MeshBasicMaterial({color:0x09090b,side:THREE.BackSide});
let character=null, outlines=[];

const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshToonMaterial({color:0xfff6e9,gradientMap:makeGradientMap(2)}));
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
const grid=new THREE.GridHelper(40,20,0x161218,0x302a2d);grid.position.y=.01;scene.add(grid);
const keyLight=new THREE.DirectionalLight(0xfff0db,2.5);keyLight.position.set(-5,10,6);keyLight.castShadow=true;scene.add(keyLight);
const ambientLight=new THREE.HemisphereLight(0xffe0e0,0x4a3c67,1.8);scene.add(ambientLight);
const rimLight=new THREE.DirectionalLight(0xded4ff,1.4);rimLight.position.set(7,5,-7);scene.add(rimLight);

function fitCharacter(root){
  const box=new THREE.Box3().setFromObject(root), size=new THREE.Vector3(), center=new THREE.Vector3();box.getSize(size);box.getCenter(center);
  const targetHeight=3.4, scale=targetHeight/Math.max(size.y,.001);root.scale.setScalar(scale);
  const b2=new THREE.Box3().setFromObject(root);b2.getCenter(center);root.position.x-=center.x;root.position.z-=center.z;root.position.y-=b2.min.y;
  controls.target.set(0,targetHeight*.52,0);homeTarget.copy(controls.target);
}
function addOutline(mesh){const o=new THREE.Mesh(mesh.geometry,outlineMaterial);o.scale.setScalar(1.018);o.position.copy(mesh.position);o.rotation.copy(mesh.rotation);o.quaternion.copy(mesh.quaternion);o.userData.source=mesh;mesh.parent.add(o);outlines.push(o)}

const loader=new GLTFLoader();
loader.load('./assets/runtime/characters/human_base_m_v1.glb',(gltf)=>{
  character=gltf.scene;character.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;addOutline(o)}});scene.add(character);fitCharacter(character);
  document.querySelector('#status').textContent='BASE BODY v1 · LOADED';
},undefined,(err)=>{console.error('Base model missing:',err);document.querySelector('#status').textContent='DROP human_base_m_v1.glb INTO assets/runtime/characters/';});

const cel=document.querySelector('#cel');if(cel)cel.addEventListener('change',e=>{if(!character)return;character.traverse(o=>{if(o.isMesh&&!o.userData.source){if(e.target.checked){const old=o.material;o.material=new THREE.MeshToonMaterial({map:old.map||null,color:old.color||0xffffff,gradientMap});} }});});
const outline=document.querySelector('#outline');if(outline)outline.addEventListener('change',e=>outlines.forEach(o=>o.visible=e.target.checked));
const edge=document.querySelector('#edge');if(edge)edge.addEventListener('input',e=>outlines.forEach(o=>o.scale.setScalar(Number(e.target.value))));
const key=document.querySelector('#key');if(key)key.addEventListener('input',e=>keyLight.intensity=Number(e.target.value));
const ambient=document.querySelector('#ambient');if(ambient)ambient.addEventListener('input',e=>ambientLight.intensity=Number(e.target.value));
const rim=document.querySelector('#rim');if(rim)rim.addEventListener('change',e=>rimLight.visible=e.target.checked);

function resetCamera(){camera.position.copy(homePosition);controls.target.copy(homeTarget);controls.update()}
app.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r')resetCamera();if(e.key.toLowerCase()==='h')document.querySelectorAll('.panel,.jp-card,.logo,.version,.topbar').forEach(x=>x.hidden=!x.hidden)});app.focus();
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});
(function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)})();
