import assert from 'node:assert/strict';import fs from 'node:fs/promises';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {rigModel,animatePassenger} from '../dist/characters.js';import {VEHICLE_BOXES} from '../dist/clearance.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async b=>{const a=Buffer.from(await b.arrayBuffer());return {width:a.readUInt32BE(16),height:a.readUInt32BE(20),close(){}};};globalThis.ProgressEvent=class{constructor(t,v){Object.assign(this,v);}};
const people=[{name:'Homero',height:1.85,hip:.37,knee:.19,shoulder:.65,sx:.19},{name:'Marge',height:2.25,hip:.25,knee:.11,shoulder:.49,sx:.075},{name:'Bart',height:1.23,hip:.38,knee:.20,shoulder:.61,sx:.13},{name:'Lisa',height:1.15,hip:.35,knee:.17,shoulder:.56,sx:.12},{name:'Maggie',height:.83,hip:.18,knee:.09,shoulder:.48,sx:.13}];
for(const person of people){
 const bytes=await fs.readFile(new URL(`../dist/assets/${person.name}.glb`,import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const {root,rig}=rigModel(gltf.scene,person);
 assert.equal(rig.bones.length,9);const before=rig.bones.map(b=>b.quaternion.toArray());
 for(let i=0;i<360;i++){
  const v=i<120?0:25,ac=i<120?0:60,load=i<120?1:6,at=i<240?4:-8;
  animatePassenger(rig,{v,ac,load,at},i/60,1/60);root.updateMatrixWorld(true);rig.mesh.skeleton.update();
  if(i%30===0){const point=new THREE.Vector3();for(let j=0;j<rig.mesh.geometry.attributes.position.count;j+=5){rig.mesh.getVertexPosition(j,point);point.applyMatrix4(rig.mesh.matrixWorld);assert.ok(point.toArray().every(Number.isFinite));assert.ok(VEHICLE_BOXES.some(b=>point.toArray().every((v,k)=>Math.abs(v-b.center[k])<=b.half[k])),`${person.name} escaped clearance envelope at ${i}`);}}
 }
 for(const bone of [3,4,5,6,7,8])assert.notDeepEqual(rig.bones[bone].quaternion.toArray(),before[bone],person.name+' must move arms, torso, head and elbows');
 console.log(person.name,'animated in idle, descending and loop states; finite skin deformation inside the passage envelope.');
}
