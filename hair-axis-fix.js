import * as THREE from 'three';

const clean=n=>(n||'').toLowerCase().replace(/^mixamorig[:_]?/,'').replace(/[^a-z0-9]/g,'');
let last=null;
function findHead(root){let head=null;root?.traverse?.(o=>{if(!head&&o.isBone&&clean(o.name)==='head')head=o});return head}
function align(){
  const lab=window.ggHairLab,character=lab?.character,modular=lab?.modular;
  if(character&&modular){
    const head=findHead(character);
    if(head&&modular.parent===head){
      head.updateWorldMatrix(true,false);character.updateWorldMatrix(true,false);
      const qHead=new THREE.Quaternion(),qCharacter=new THREE.Quaternion(),worldScale=new THREE.Vector3();
      head.getWorldQuaternion(qHead);character.getWorldQuaternion(qCharacter);head.getWorldScale(worldScale);
      const qAlign=qHead.clone().invert().multiply(qCharacter);
      modular.quaternion.copy(qAlign);
      modular.scale.set(
        1/Math.max(Math.abs(worldScale.x),1e-5),
        1/Math.max(Math.abs(worldScale.y),1e-5),
        1/Math.max(Math.abs(worldScale.z),1e-5)
      );
      const charH=new THREE.Box3().setFromObject(character).getSize(new THREE.Vector3()).y;
      const offsetWorld=new THREE.Vector3(0,charH*.074,0);
      const offsetLocal=offsetWorld.applyQuaternion(qHead.clone().invert());
      offsetLocal.x/=Math.max(Math.abs(worldScale.x),1e-5);offsetLocal.y/=Math.max(Math.abs(worldScale.y),1e-5);offsetLocal.z/=Math.max(Math.abs(worldScale.z),1e-5);
      modular.position.copy(offsetLocal);
      if(modular!==last){console.info('[GG HAIR AXIS] Hair lowered to skull',{worldScale:worldScale.toArray(),localScale:modular.scale.toArray(),position:modular.position.toArray()});last=modular}
    }
  }
  requestAnimationFrame(align);
}
requestAnimationFrame(align);
console.info('[GG HAIR AXIS] Character-aligned + lower crown hair frame armed.');