import * as THREE from 'three';

const clean=n=>(n||'').toLowerCase().replace(/^mixamorig[:_]?/,'').replace(/[^a-z0-9]/g,'');
let last=null;

function findHead(root){let head=null;root?.traverse?.(o=>{if(!head&&o.isBone&&clean(o.name)==='head')head=o});return head}

function align(){
  const lab=window.ggHairLab;
  const character=lab?.character;
  const modular=lab?.modular;
  if(character&&modular){
    const head=findHead(character);
    if(head&&modular.parent===head){
      head.updateWorldMatrix(true,false);
      character.updateWorldMatrix(true,false);
      const qHead=new THREE.Quaternion(),qCharacter=new THREE.Quaternion();
      head.getWorldQuaternion(qHead);
      character.getWorldQuaternion(qCharacter);
      const qAlign=qHead.clone().invert().multiply(qCharacter);
      modular.quaternion.copy(qAlign);

      const charBox=new THREE.Box3().setFromObject(character);
      const charH=charBox.getSize(new THREE.Vector3()).y;
      const localUpOffset=new THREE.Vector3(0,charH*.0114,0).applyQuaternion(qAlign);
      modular.position.copy(localUpOffset);

      if(modular!==last){
        console.info('[GG HAIR AXIS] Modular hair aligned to character frame.',{
          head:head.name,
          quaternion:modular.quaternion.toArray(),
          position:modular.position.toArray()
        });
        last=modular;
      }
    }
  }
  requestAnimationFrame(align);
}

requestAnimationFrame(align);
console.info('[GG HAIR AXIS] Character-aligned hair frame armed.');