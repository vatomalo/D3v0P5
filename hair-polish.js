import * as THREE from 'three';

let last=null;
function polish(){
  const modular=window.ggHairLab?.modular;
  if(modular&&modular!==last){
    modular.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(modular),size=box.getSize(new THREE.Vector3());
    const cap=modular.children.find(o=>o.isMesh&&o.geometry?.type==='SphereGeometry');
    if(cap){
      cap.scale.x*=0.88;cap.scale.y*=0.72;cap.scale.z*=0.82;
      cap.position.y+=Math.max(size.y*.035,0.01);
      cap.position.z-=Math.max(size.z*.025,0.005);
    }
    const ribbons=modular.children.filter(o=>o.isMesh&&o!==cap&&o.geometry?.attributes?.position);
    for(const mesh of ribbons){
      const pos=mesh.geometry.attributes.position;
      mesh.geometry.computeBoundingBox();
      const b=mesh.geometry.boundingBox,center=b.getCenter(new THREE.Vector3());
      const side=Math.sign(center.x);
      for(let i=0;i<pos.count;i++){
        let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const t=(b.max.y-b.min.y)>1e-6?(y-b.min.y)/(b.max.y-b.min.y):0;
        if(Math.abs(center.x)>size.x*.12){
          x*=0.92;
          z-=Math.abs(x)*0.10*(0.35+0.65*t);
          if(side!==0)x-=side*Math.abs(y-b.max.y)*0.035;
        }
        if(y>b.min.y+(b.max.y-b.min.y)*0.68){x*=0.94;z*=0.96;}
        pos.setXYZ(i,x,y,z);
      }
      pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    }
    console.info('[GG HAIR POLISH] Cap tightened, side locks wrapped, ribbon roots narrowed.');
    last=modular;
  }
  requestAnimationFrame(polish);
}
requestAnimationFrame(polish);
console.info('[GG HAIR POLISH] Modular silhouette polish armed.');