import * as THREE from 'three';

const clean=n=>(n||'').toLowerCase().replace(/^mixamorig[:_]?/,'').replace(/[^a-z0-9]/g,'');
const seen=new WeakSet();
function findHead(root){let head=null;root?.traverse?.(o=>{if(!head&&o.isBone&&clean(o.name)==='head')head=o});return head}
function alignCarrier(carrier,head,character,qAlign,worldScale,offset){
  if(!carrier||carrier.parent!==head)return;
  carrier.quaternion.copy(qAlign);
  // Keep the carrier in character world units even when the source head bone is scaled.
  carrier.scale.set(
    1/Math.max(Math.abs(worldScale.x),1e-5),
    1/Math.max(Math.abs(worldScale.y),1e-5),
    1/Math.max(Math.abs(worldScale.z),1e-5)
  );
  carrier.position.copy(offset);
  if(!seen.has(carrier)){
    console.info('[GG HAIR AXIS] Character-aligned hair carrier',carrier.name||'imported hair');
    seen.add(carrier);
  }
}
function align(){
  const lab=window.ggHairLab,character=lab?.character;
  if(character){
    const head=findHead(character);
    if(head){
      head.updateWorldMatrix(true,false);character.updateWorldMatrix(true,false);
      const qHead=new THREE.Quaternion(),qCharacter=new THREE.Quaternion(),worldScale=new THREE.Vector3();
      head.getWorldQuaternion(qHead);character.getWorldQuaternion(qCharacter);head.getWorldScale(worldScale);
      const qAlign=qHead.clone().invert().multiply(qCharacter);
      const charH=new THREE.Box3().setFromObject(character).getSize(new THREE.Vector3()).y;
      const offset=new THREE.Vector3(0,charH*.074,0).applyQuaternion(qHead.clone().invert());
      offset.x/=Math.max(Math.abs(worldScale.x),1e-5);offset.y/=Math.max(Math.abs(worldScale.y),1e-5);offset.z/=Math.max(Math.abs(worldScale.z),1e-5);
      alignCarrier(lab?.modular,head,character,qAlign,worldScale,offset);
      alignCarrier(lab?.hair,head,character,qAlign,worldScale,offset);
    }
  }
  requestAnimationFrame(align);
}
requestAnimationFrame(align);
console.info('[GG HAIR AXIS] Character-aligned imported and modular hair frames armed.');
