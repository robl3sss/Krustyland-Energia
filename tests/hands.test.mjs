import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rigModel,animatePassenger} from '../dist/characters.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const a=Buffer.from(await blob.arrayBuffer());return {width:a.readUInt32BE(16),height:a.readUInt32BE(20),close(){}};};
globalThis.ProgressEvent=class {constructor(type,values){Object.assign(this,values);}};
const people=[
 {name:'Homero',height:1.85,hip:.37,knee:.19,shoulder:.65,sx:.19,handX:.375},
 {name:'Marge',height:2.25,hip:.25,knee:.11,shoulder:.49,sx:.075,handX:.225},
 {name:'Bart',height:1.23,hip:.38,knee:.20,shoulder:.61,sx:.13,handX:.305},
 {name:'Lisa',height:1.15,hip:.35,knee:.17,shoulder:.56,sx:.12,handX:.29},
 {name:'Maggie',height:.83,hip:.18,knee:.09,shoulder:.48,sx:.13,handX:.275}
];
// The original finger/palm shape must survive seating and every animated pose.
// This catches the old masks that dragged fingers into torso/leg transforms.
for(const person of people){
 const bytes=await fs.readFile(new URL(`../dist/assets/${person.name}.glb`,import.meta.url));
 const original=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const {root,rig}=rigModel(original.scene,person),p=rig.mesh.geometry.attributes.position;
 const H=rig.mesh.geometry.boundingBox.max.y;
 const hands=[-1,1].map(side=>{
  const ids=[];for(let i=0;i<p.count;i++)if(side*p.getX(i)>person.handX*H)ids.push(i);
  assert.ok(ids.length>15,person.name+' hand geometry is present');
  const center=new THREE.Vector3();for(const i of ids)center.add(new THREE.Vector3().fromBufferAttribute(p,i));center.divideScalar(ids.length);
  return {ids,radii:ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(center)*rig.scale)};
 });
 for(let frame=0;frame<=180;frame++){
  animatePassenger(rig,{v:frame<60?0:30,at:frame<120?4:-8,ac:65,load:6},frame/60,1/60,frame===180);
  if(frame%30)continue;
  root.updateMatrixWorld(true);rig.mesh.skeleton.update();
  for(const {ids,radii} of hands){
   const posed=ids.map(i=>rig.mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(rig.mesh.matrixWorld));
   const center=posed.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).divideScalar(posed.length);
   posed.forEach((v,i)=>assert.ok(Math.abs(v.distanceTo(center)-radii[i])<1e-5,`${person.name}: palm/finger shape changed at frame ${frame}`));
  }
 }
 console.log(person.name+': both original hands retain their shape in seated, moving and reduced-motion poses.');
}
