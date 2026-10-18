import * as THREE from 'three';

// Use only the supplied head geometry and both original textures. Smooth
// shared vertex normals without changing UVs, facial features or proportions.
export function makeKrustyFace(original){
 const root=new THREE.Group();root.name='Krusty · cabeza original';
 original.traverse(source=>{
  if(!source.isMesh)return;
  const g=source.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,groups=new Map();
  for(let i=0;i<p.count;i++){
   const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(',');
   let item=groups.get(key);if(!item){item={ids:[],normal:new THREE.Vector3()};groups.set(key,item);}item.ids.push(i);item.normal.add(new THREE.Vector3().fromBufferAttribute(n,i));
  }
  for(const item of groups.values()){item.normal.normalize();for(const i of item.ids)n.setXYZ(i,...item.normal.toArray());}n.needsUpdate=true;
  const mat=new THREE.MeshBasicMaterial({map:source.material.map,color:source.material.color,side:THREE.DoubleSide});mat.name=source.material.name;
  const mesh=new THREE.Mesh(g,mat);mesh.name=source.name;root.add(mesh);
 });
 return root;
}
