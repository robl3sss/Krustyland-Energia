import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildTrack,sampleTrack} from '../dist/physics.js';
import {buildSupports,segmentClear,clearanceFrames} from '../dist/clearance.js';
const localBoxes=[new THREE.Box3(new THREE.Vector3(-1.4,.27,-2.08),new THREE.Vector3(1.4,3.03,2.08)),...[-.98,.98].flatMap(x=>[-1.12,1.12].map(z=>new THREE.Box3(new THREE.Vector3(x-.44,-.46,z-.5),new THREE.Vector3(x+.44,.70,z+.5))))];
let checked=0;
for(const family of [false,true])for(const height of [14,32,50])for(const radius of [4,6.8,9]){
 const track=buildTrack({height,radius});if(family)track.drawStart=-20.4;const supports=buildSupports(track);assert.ok(supports.length>0);
 // Independent dense check using Three.js Ray/Box intersections in the
 // carriage coordinate system, instead of the generation slab routine.
 for(let s=track.drawStart||0;s<track.length;s+=.17){
  const f=sampleTrack(track,s),T=new THREE.Vector3(...f.T),B=new THREE.Vector3(0,0,1).addScaledVector(T,-T.z).normalize(),U=B.clone().cross(T).normalize();
  const center=new THREE.Vector3(...f.p),matrix=new THREE.Matrix4().makeBasis(B,U,T);matrix.setPosition(center);matrix.invert();
  for(const q of supports){
   const a=new THREE.Vector3(...q.a).applyMatrix4(matrix),b=new THREE.Vector3(...q.b).applyMatrix4(matrix),d=b.clone().sub(a),length=d.length();const ray=new THREE.Ray(a,d.normalize());
   for(const localBox of localBoxes){const hit=ray.intersectBox(localBox.clone().expandByScalar(q.r),new THREE.Vector3());
   assert.ok(!hit||hit.distanceTo(a)>length+1e-7,`Support intersects carriage at height ${height}, radius ${radius}, s ${s}`);checked++;}
  }
 }
}
const track=buildTrack(),f=sampleTrack(track,track.landmarks[2].s),frames=clearanceFrames(track);
assert.equal(segmentClear([f.p[0],0,f.p[2]],[f.p[0],50,f.p[2]],frames),false,'A column through the loop must be rejected');
assert.equal(segmentClear([-100,0,25],[-100,50,25],frames),true);
console.log(`Support clearance passed for 18 individual/family geometries: ${checked} independent segment/vehicle checks, including inverted positions.`);
