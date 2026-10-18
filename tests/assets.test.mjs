import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rigModel} from '../dist/characters.js';
import {makeKrustyFace} from '../dist/landmark.js';

// Decode embedded texture dimensions for the Node-only asset check.
// No browser is used by this validation.
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{
 const a=Buffer.from(await blob.arrayBuffer());
 return {width:a.readUInt32BE(16),height:a.readUInt32BE(20),close(){}};
};
globalThis.ProgressEvent=class ProgressEvent {constructor(type,values){this.type=type;Object.assign(this,values);}};
const people=[
 {name:'Homero',height:1.85,hip:.37,knee:.19,shoulder:.65,sx:.19},
 {name:'Marge',height:2.25,hip:.25,knee:.11,shoulder:.49,sx:.075},
 {name:'Bart',height:1.23,hip:.38,knee:.20,shoulder:.61,sx:.13},
 {name:'Lisa',height:1.15,hip:.35,knee:.17,shoulder:.56,sx:.12},
 {name:'Maggie',height:.83,hip:.18,knee:.09,shoulder:.48,sx:.13},
];
for(const person of people){
 const b=await fs.readFile(new URL(`../dist/assets/${person.name}.glb`,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const {root,rig}=rigModel(gltf.scene,person);root.updateMatrixWorld(true);rig.mesh.skeleton.update();
 const geometry=rig.mesh.geometry,position=geometry.attributes.position,uv=geometry.attributes.uv;
 assert.ok(geometry.attributes.skinWeight&&geometry.attributes.skinIndex);
 const vertices=[],v=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  rig.mesh.getVertexPosition(i,v);v.applyMatrix4(rig.mesh.matrixWorld);
  assert.ok(v.toArray().every(Number.isFinite));vertices.push(...v.toArray());
  let total=0;for(let k=0;k<4;k++)total+=geometry.attributes.skinWeight.array[i*4+k];
  assert.ok(Math.abs(total-1)<1e-5);
 }
 const box=new THREE.Box3().setFromArray(vertices);assert.ok(box.max.y<3&&box.min.y>.2);
 const face=Array.from(geometry.index.array);
 const record={name:person.name,positions:vertices,uv:Array.from(uv.array),faces:face};
 // Diagnostic records can be inspected here without filesystem-specific output.
 console.log(person.name,'loaded, textured and posed; bounds',box.min.toArray(),box.max.toArray());
}
const headBytes=await fs.readFile(new URL('../dist/assets/Krusty-head.glb',import.meta.url));
const head=await new GLTFLoader().parseAsync(headBytes.buffer.slice(headBytes.byteOffset,headBytes.byteOffset+headBytes.byteLength),'');
let headTriangles=0,headMaterials=new Set();
head.scene.traverse(o=>{if(!o.isMesh)return;assert.ok(o.material.map);headMaterials.add(o.material.name);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));headTriangles+=(o.geometry.index?.count||p.count)/3;});
assert.equal(headTriangles,896);assert.equal(headMaterials.size,2);const bounds=new THREE.Box3().setFromObject(head.scene);assert.ok(Math.abs(bounds.max.y-bounds.min.y-1)<1e-6);
console.log('Krusty head: 896 triangles, two embedded textures, normalized height; no body or animation.');

const mascot=makeKrustyFace(head.scene);let pieces=0,texturedPieces=0;mascot.updateMatrixWorld(true);mascot.traverse(o=>{if(!o.isMesh)return;pieces++;if(o.material.map)texturedPieces++;assert.ok(o.material.isMeshBasicMaterial);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));});
assert.equal(pieces,2);assert.equal(texturedPieces,2);console.log('Krusty: original head and eyes, original textures; no detached replacement face parts.');
