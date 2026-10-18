import * as THREE from 'three';

// Joint centers measured on each supplied A/T-pose mesh, as fractions of height.
// The children already have lowered arms; height-only masks cut through their hands.
const ANATOMY={
 Homero:{shoulder:[.19,.62,-.018],elbow:[.28,.59,-.018],wrist:[.365,.565,-.018]},
 Marge:{shoulder:[.075,.485,-.013],elbow:[.145,.442,-.013],wrist:[.215,.403,-.013]},
 Bart:{shoulder:[.12,.56,-.028],elbow:[.215,.444,-.028],wrist:[.295,.335,-.028]},
 Lisa:{shoulder:[.12,.48,0],elbow:[.205,.407,0],wrist:[.28,.327,0]},
 Maggie:{shoulder:[.13,.46,.016],elbow:[.195,.389,.016],wrist:[.265,.309,.016]}
};
export function rigModel(original,person){
 const root=new THREE.Group();let rigResult=null;
 original.traverse(source=>{
  if(!source.isMesh)return;
  const geometry=source.geometry.clone(),p=geometry.attributes.position,H=geometry.boundingBox?.max.y||new THREE.Box3().setFromBufferAttribute(p).max.y;
  const anatomy=ANATOMY[person.name],hip=person.hip*H,knee=person.knee*H,
   shoulder=anatomy.shoulder[1]*H,sx=anatomy.shoulder[0]*H,
   chest=hip+.4*(person.shoulder*H-hip),neck=(person.shoulder+.04)*H,
   elbow=anatomy.elbow[0]*H,ey=anatomy.elbow[1]*H,sz=anatomy.shoulder[2]*H;
  const bones=Array.from({length:9},()=>new THREE.Bone());
  ['Body','Hips','Knees','LeftArm','RightArm','Chest','Head','LeftForearm','RightForearm'].forEach((name,i)=>bones[i].name=name);
  bones[1].position.set(0,hip,0);bones[2].position.set(0,knee-hip,0);bones[5].position.set(0,chest,0);bones[6].position.set(0,neck-chest,0);
  bones[3].position.set(sx,shoulder-chest,sz);bones[4].position.set(-sx,shoulder-chest,sz);
  bones[7].position.set(elbow-sx,ey-shoulder,0);bones[8].position.set(-elbow+sx,ey-shoulder,0);
  bones[0].add(bones[1],bones[5]);bones[1].add(bones[2]);bones[5].add(bones[6],bones[3],bones[4]);bones[3].add(bones[7]);bones[4].add(bones[8]);
  const indices=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4),smooth=THREE.MathUtils.smoothstep;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),ax=Math.abs(x)/H;
   const [s,e,w]=[anatomy.shoulder,anatomy.elbow,anatomy.wrist];
   const segment=ax<e[0]?[s,e]:[e,w],t=THREE.MathUtils.clamp((ax-segment[0][0])/(segment[1][0]-segment[0][0]),0,1);
   const centerY=THREE.MathUtils.lerp(segment[0][1],segment[1][1],t);
   // Follow the sloping arm instead of fading hand vertices into the body.
   // Beyond the elbow the complete hand/fingers move rigidly with the forearm.
   const hand=smooth(ax,e[0],w[0]-.02);
   const arm=smooth(ax,s[0]-.025,s[0]+.035)*(1-smooth(Math.abs(y/H-centerY),.045+.04*hand,.085+.04*hand));
   const leg=(person.name==='Maggie'?0:1-smooth(y,hip-.025*H,hip+.06*H))*(1-arm),
    low=1-smooth(y,knee-.035*H,knee+.035*H),body=1-leg-arm,
    head=smooth(y,neck-.01*H,neck+.01*H),torso=smooth(y,hip,hip+.15*H),
    forearm=smooth(Math.abs(x),elbow-.015*H,elbow+.015*H);
   const options=[[0,body*(1-head)*(1-torso)],[1,leg*(1-low)],[2,leg*low],[5,body*(1-head)*torso],[6,body*head],[x>0?3:4,arm*(1-forearm)],[x>0?7:8,arm*forearm]].sort((a,b)=>b[1]-a[1]).slice(0,4);
   const sum=options.reduce((s,a)=>s+a[1],0)||1;for(let k=0;k<4;k++){indices[i*4+k]=options[k][0];weights[i*4+k]=options[k][1]/sum;}
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const m=new THREE.SkinnedMesh(geometry,source.material);m.add(bones[0]);m.bind(new THREE.Skeleton(bones));m.frustumCulled=false;m.castShadow=true;
  const scale=person.height/H,booster=person.height<1.4?.35:0;m.scale.setScalar(scale);m.position.set(0,1.06+booster-hip*scale+(person.name==='Maggie'?.12:0),-.25);
  root.add(m);rigResult={bones,scale,mesh:m,anatomy,phase:person.name.charCodeAt(0)*.23};
  animatePassenger(rigResult,{v:0,at:0,load:1,ac:0},0,1,false);
 });
 return {root,rig:rigResult};
}

// Visual reactions only; the simulated point mass and measured data stay on
// the rail. Exponential smoothing removes abrupt pose changes at loop entries.
export function animatePassenger(rig,state,time,dt,reduced=false){
 if(!rig)return;
 const b=rig.bones,phase=rig.phase,clamp=THREE.MathUtils.clamp;
 const moving=Math.abs(state.v)>.15,breath=reduced?0:Math.sin(time*1.9+phase),sway=reduced?0:Math.sin(time*.83+phase);
 const response=moving?clamp((state.load-1)*.06,-.06,.24):0;
 const k=1-Math.exp(-Math.max(0,dt)*13),set=(bone,axis,value)=>bone.rotation[axis]+=(value-bone.rotation[axis])*k;
 set(b[1],'x',-Math.PI/2+(reduced?0:.003*breath));set(b[2],'x',Math.PI/2-(reduced?0:.006*breath));
 set(b[5],'x',reduced?0:clamp(-state.at*.004,-.065,.065)+.006*breath);
 set(b[5],'z',reduced?0:.006*sway);set(b[5],'y',reduced?0:.005*Math.sin(time*.65+phase));
 set(b[6],'x',reduced?0:-response*.18+.012*Math.sin(time*1.15+phase));
 set(b[6],'y',reduced?0:.025*Math.sin(time*.72+phase));set(b[6],'z',reduced?0:.008*sway);
 // Pose each limb from its own bind direction. Forearms fold forward over the
 // lap, rather than rotating already lowered arms as though every mesh were T-posed.
 const {shoulder,elbow,wrist}=rig.anatomy;
 for(const [arm,fore,side] of [[3,7,1],[4,8,-1]]){
  const upperRest=new THREE.Vector3(side*(elbow[0]-shoulder[0]),elbow[1]-shoulder[1],elbow[2]-shoulder[2]).normalize();
  const foreRest=new THREE.Vector3(side*(wrist[0]-elbow[0]),wrist[1]-elbow[1],wrist[2]-elbow[2]).normalize();
  const drift=reduced?0:.008*Math.sin(time*1.85+phase+side);
  const upperDirection=new THREE.Vector3(side*.16,-.96,.23+response*.08+drift).normalize();
  const foreDirection=new THREE.Vector3(-side*.27,-.12+drift,.955).normalize();
  const upperQ=new THREE.Quaternion().setFromUnitVectors(upperRest,upperDirection);
  const worldForeQ=new THREE.Quaternion().setFromUnitVectors(foreRest,foreDirection);
  const localForeQ=upperQ.clone().invert().multiply(worldForeQ);
  b[arm].quaternion.slerp(upperQ,k);b[fore].quaternion.slerp(localForeQ,k);
 }
}
