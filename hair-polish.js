import * as THREE from 'three';

let last=null;
function cloneStrand(mesh,dx,dy,dz,scaleX=.72,scaleY=1.02,scaleZ=.9){
  const c=mesh.clone();
  c.geometry=mesh.geometry.clone();
  c.material=mesh.material;
  c.position.set(dx,dy,dz);
  c.scale.set(scaleX,scaleY,scaleZ);
  c.renderOrder=mesh.renderOrder;
  c.frustumCulled=false;
  c.userData.ggExtraHairStrand=true;
  return c;
}
function polish(){
  const modular=window.ggHairLab?.modular;
  if(modular&&modular!==last){
    modular.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(modular),size=box.getSize(new THREE.Vector3());
    const cap=modular.children.find(o=>o.isMesh&&o.geometry?.type==='SphereGeometry');
    if(cap){
      cap.scale.x*=0.86;cap.scale.y*=0.58;cap.scale.z*=0.84;
      cap.position.y-=Math.max(size.y*.015,0.006);
      cap.position.z-=Math.max(size.z*.02,0.004);
    }
    const originals=modular.children.filter(o=>o.isMesh&&o!==cap&&o.geometry?.attributes?.position&&!o.userData.ggExtraHairStrand);
    const extras=[];
    for(const mesh of originals){
      const pos=mesh.geometry.attributes.position;
      mesh.geometry.computeBoundingBox();
      const b=mesh.geometry.boundingBox,center=b.getCenter(new THREE.Vector3());
      const sx=b.max.x-b.min.x,sy=b.max.y-b.min.y,sz=b.max.z-b.min.z;
      const side=Math.sign(center.x);
      const isSide=Math.abs(center.x)>size.x*.13;
      const isVertical=sy>sx*.9;
      for(let i=0;i<pos.count;i++){
        let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const ty=sy>1e-6?(y-b.min.y)/sy:0;
        if(isSide){
          const cx=center.x;
          x=cx+(x-cx)*0.48;
          y=b.max.y+(y-b.max.y)*1.14;
          z-=Math.abs(cx)*0.055*(0.25+0.75*ty);
          if(side!==0)x-=side*Math.abs(y-b.max.y)*0.018;
        }else{
          y=b.min.y+(y-b.min.y)*0.86;
          x*=0.92;
        }
        if(ty>.70){x*=0.95;z*=0.97;}
        pos.setXYZ(i,x,y,z);
      }
      pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
      if(isSide&&isVertical){
        const off=Math.max(sx*.18,size.x*.012);
        extras.push(cloneStrand(mesh,-side*off*.55,-sy*.025,-sz*.035,.68,1.03,.92));
        extras.push(cloneStrand(mesh, side*off*.72, sy*.015, sz*.028,.62,.97,.88));
      }else if(sy>sx*.65){
        const off=Math.max(sx*.12,size.x*.008);
        extras.push(cloneStrand(mesh,off,sy*.01,-sz*.018,.70,.98,.92));
      }
    }
    extras.forEach(e=>modular.add(e));
    console.info('[GG HAIR POLISH] Lower cap, Y-dominant side strands, denser layered ribbon set.',{originals:originals.length,extras:extras.length});
    last=modular;
  }
  requestAnimationFrame(polish);
}
requestAnimationFrame(polish);
console.info('[GG HAIR POLISH] Dense vertical strand polish v2 armed.');