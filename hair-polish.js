import * as THREE from 'three';

let last=null;
const state={amount:3};
const $=id=>document.getElementById(id);
function ensureAmountUI(){
  const page=document.querySelector('[data-workspace-page="hair"]');
  if(!page||$('hair-amount'))return;
  const volume=$('hair-volume')?.closest('.row');
  if(!volume)return;
  const row=document.createElement('label');row.className='row';row.innerHTML='<span>HAIR AMOUNT</span><input id="hair-amount" type="range" min="1" max="6" step="1" value="3">';
  volume.after(row);
  $('hair-amount')?.addEventListener('input',e=>{state.amount=Number(e.target.value);last=null;window.ggHairLab?.rebuildModular?.()});
}
function cloneStrand(mesh,dx,dy,dz,scaleX=.76,scaleY=1,scaleZ=.9){
  const c=mesh.clone();c.geometry=mesh.geometry.clone();c.material=mesh.material;c.position.set(dx,dy,dz);c.scale.set(scaleX,scaleY,scaleZ);c.renderOrder=mesh.renderOrder;c.frustumCulled=false;c.userData.ggExtraHairStrand=true;return c;
}
function orientSideRibbon(mesh){
  const pos=mesh.geometry.attributes.position;if(!pos||pos.count<4)return;
  mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,center=b.getCenter(new THREE.Vector3()),sx=b.max.x-b.min.x,sy=b.max.y-b.min.y,sz=b.max.z-b.min.z;
  if(sy<Math.max(sx,sz)*.75)return;
  /* Ribbon vertices are emitted as left/right pairs. For side hair, preserve the curve centerline but rotate ribbon WIDTH from X into Z, giving a YZ-facing lock. */
  for(let i=0;i+1<pos.count;i+=2){
    const ax=pos.getX(i),ay=pos.getY(i),az=pos.getZ(i),bx=pos.getX(i+1),by=pos.getY(i+1),bz=pos.getZ(i+1);
    const cx=(ax+bx)*.5,cy=(ay+by)*.5,cz=(az+bz)*.5;
    const half=Math.max(Math.hypot(ax-bx,ay-by,az-bz)*.5,.0001)*.72;
    pos.setXYZ(i,cx,cy,cz-half);pos.setXYZ(i+1,cx,cy,cz+half);
  }
  pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
}
function polish(){
  ensureAmountUI();
  const modular=window.ggHairLab?.modular;
  if(modular&&modular!==last){
    modular.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(modular),size=box.getSize(new THREE.Vector3());
    const cap=modular.children.find(o=>o.isMesh&&o.geometry?.type==='SphereGeometry');
    if(cap){cap.scale.x*=0.86;cap.scale.y*=0.50;cap.scale.z*=0.84;cap.position.y-=Math.max(size.y*.035,0.01);cap.position.z-=Math.max(size.z*.02,0.004)}
    const originals=modular.children.filter(o=>o.isMesh&&o!==cap&&o.geometry?.attributes?.position&&!o.userData.ggExtraHairStrand);
    const extras=[];
    for(const mesh of originals){
      mesh.geometry.computeBoundingBox();let b=mesh.geometry.boundingBox,center=b.getCenter(new THREE.Vector3()),sx=b.max.x-b.min.x,sy=b.max.y-b.min.y,sz=b.max.z-b.min.z;
      const side=Math.sign(center.x),isSide=Math.abs(center.x)>size.x*.13,isBack=center.z<-(size.z*.08);
      if(isSide){
        orientSideRibbon(mesh);
        const pos=mesh.geometry.attributes.position;mesh.geometry.computeBoundingBox();b=mesh.geometry.boundingBox;center=b.getCenter(new THREE.Vector3());sx=b.max.x-b.min.x;sy=b.max.y-b.min.y;sz=b.max.z-b.min.z;
        for(let i=0;i<pos.count;i++){
          let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const ty=sy>1e-6?(y-b.min.y)/sy:0;
          const cx=center.x;x=cx+(x-cx)*.72;y=b.max.y+(y-b.max.y)*1.08;z-=Math.abs(cx)*.035*(.2+.8*ty);if(side)x-=side*Math.abs(y-b.max.y)*.012;pos.setXYZ(i,x,y,z);
        }
        pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
        const count=Math.max(0,state.amount-1),spread=Math.max(size.z*.015,.006);
        for(let j=0;j<count;j++){
          const k=j-(count-1)/2,depth=k*spread,vertical=((j%2)*2-1)*sy*.012;
          extras.push(cloneStrand(mesh,-side*Math.abs(k)*size.x*.004,vertical,depth,.82-j*.035,1+(j%2?-.025:.02),.94));
        }
      }else if(isBack){
        const count=Math.max(0,state.amount-2),spread=Math.max(size.x*.012,.005);
        for(let j=0;j<count;j++){const k=j-(count-1)/2;extras.push(cloneStrand(mesh,k*spread,(j%2?1:-1)*sy*.008,-Math.abs(k)*size.z*.004,.82,1,.94))}
      }
    }
    extras.forEach(e=>modular.add(e));
    console.info('[GG HAIR POLISH] Side locks rotated to YZ plane.',{amount:state.amount,originals:originals.length,extras:extras.length});last=modular;
  }
  requestAnimationFrame(polish);
}
requestAnimationFrame(polish);
window.ggHairPolish={state,setAmount(v){state.amount=Math.max(1,Math.min(6,Number(v)||1));if($('hair-amount'))$('hair-amount').value=state.amount;last=null;window.ggHairLab?.rebuildModular?.()}};
console.info('[GG HAIR POLISH] Side-plane ribbon orientation + adjustable hair amount armed.');