import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildTrack, sampleTrack, Simulator, G, BASE } from './physics.js';
import { rigModel, animatePassenger } from './characters.js';
import { makeKrustyFace } from './landmark.js';
import { buildSupports } from './clearance.js';

const $=id=>document.getElementById(id);
const people=[
 {name:'Homero',mass:100,height:1.85,hip:.37,knee:.19,shoulder:.65,sx:.19},
 {name:'Marge',mass:65,height:2.25,hip:.25,knee:.11,shoulder:.49,sx:.075},
 {name:'Bart',mass:35,height:1.23,hip:.38,knee:.20,shoulder:.61,sx:.13},
 {name:'Lisa',mass:30,height:1.15,hip:.35,knee:.17,shoulder:.56,sx:.12},
 {name:'Maggie',mass:10,height:.83,hip:.18,knee:.09,shoulder:.48,sx:.13},
];
const FAMILY={name:"Familia",family:true,mass:240};
const choices=[...people,FAMILY],familyMasses=Object.fromEntries(people.map(p=>[p.name,p.mass]));
const activePeople=()=>chosen.family?people:[chosen];
const vehicleMass=()=>55*activePeople().length;
const riderMass=()=>chosen.family?Object.values(familyMasses).reduce((a,b)=>a+b,0):+document.getElementById("mass").value;
let vehicles=[],couplers=[];
let chosen=people[0],track,sim,playing=false,cameraMode='boarding',unit='J',lastPaint=0,lastTime=0;
let renderer,scene,camera,orbit,trackGroup,car,ferris,passenger,passengerRig,sceneReady=false;
let characterRequest=0;const cache=new Map();const vectorGroup=new THREE.Group();
const up=new THREE.Vector3(0,1,0),zaxis=new THREE.Vector3(0,0,1),cameraAim=new THREE.Vector3(),cameraLookMatrix=new THREE.Matrix4(),cameraLookQ=new THREE.Quaternion(),wheelQ=new THREE.Quaternion();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const basis=new THREE.Matrix4(),right=new THREE.Vector3(),normalUp=new THREE.Vector3(),tangent=new THREE.Vector3();
const observer=new ResizeObserver(()=>{resizeScene();drawCharts();});
const fmt=(x,d=2)=>Number.isFinite(x)?x.toLocaleString('es-GT',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const toast=text=>{const el=$('toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),3300);};

function selectPassenger(person){
 chosen=person;$('mass').value=person.mass;$('passengerName').textContent=person.family?'Toda la familia':person.name+' Simpson';
 $('currentPassengerImage').hidden=!!person.family;$('familyPortrait').hidden=!person.family;
 if(!person.family){$('currentPassengerImage').src=`./assets/${person.name}.png`;$('currentPassengerImage').alt=person.name;}
 $('familyMassControls').hidden=!person.family;$('mass').hidden=!!person.family;$('mass').disabled=!!person.family;
 $('massLabelText').textContent=person.family?'Masa de los cinco pasajeros':'Masa del pasajero';$('seatTag').textContent=person.family?'5 ASIENTOS':'1 ASIENTO';
 $('familyInfo').hidden=!person.family;$('heightLabel').textContent=person.family?'ALTURA DEL CM':'ALTURA';
 document.querySelectorAll('.character-button').forEach(x=>{const active=x.dataset.person===person.name;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});
 resetSimulation(true);if(sceneReady)loadPassengers();setCamera('boarding',true);
}
for(const person of choices){
 const b=document.createElement('button');b.className='character-button'+(person===chosen?' active':'')+(person.family?' family-button':'');b.dataset.person=person.name;b.setAttribute('aria-label',person.family?'Subir a toda la familia en cinco carritos':`Subir a ${person.name}, masa inicial ${person.mass} kg`);b.setAttribute('aria-pressed',String(person===chosen));
 if(person.family){const portraits=document.createElement('span');portraits.className='family-portraits';for(const p of people){const img=document.createElement('img');img.src=`./assets/${p.name}.png`;img.alt='';portraits.append(img);}b.append(portraits);}else{const img=document.createElement('img');img.src=`./assets/${person.name}.png`;img.alt='';b.append(img);}
 const copy=document.createElement('span');copy.className='character-copy';const name=document.createElement('strong');name.textContent=person.family?'Toda la familia':person.name;const mass=document.createElement('small');mass.textContent=person.family?'5 carritos unidos':person.mass+' kg iniciales';copy.append(name,mass);b.append(copy);
 b.onclick=()=>selectPassenger(person);
 b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();let i=choices.indexOf(person);i=e.key==='Home'?0:e.key==='End'?choices.length-1:(i+(e.key==='ArrowRight'?1:-1)+choices.length)%choices.length;selectPassenger(choices[i]);$('characters').children[i].focus();}};
 $('characters').append(b);
}
for(const person of people){const row=document.createElement('label');row.className='family-mass-row';row.textContent=person.name;const input=document.createElement('input');input.type='number';input.min=5;input.max=160;input.step=1;input.value=person.mass;input.setAttribute('aria-label','Masa de '+person.name+' en kilogramos');input.onchange=()=>{const n=Number(input.value);familyMasses[person.name]=Number.isFinite(n)?Math.max(5,Math.min(160,n)):person.mass;input.value=familyMasses[person.name];resetSimulation(false);};row.append(input,document.createTextNode('kg'));$('familyMassControls').append(row);const img=document.createElement('img');img.src=`./assets/${person.name}.png`;img.alt=person.name;$('familyPortrait').append(img);}

function material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.8,...extra});}
const mats={rail:material(0xd94b37,{roughness:.42,metalness:.32}),railEdge:material(0xf4c34f,{roughness:.45,metalness:.25}),support:material(0xe7ead7),dark:material(0x214e4c),wood:material(0xa9825c),gold:material(0xefbc38),red:material(0xd94837),seat:material(0x234946),black:material(0x283534),steel:material(0x9eb6b0,{metalness:.65,roughness:.3})};
function mesh(geo,mat,parent=scene){const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,mat,parent,x=0,y=0,z=0){const m=mesh(new THREE.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);return m;}
function ball(r,mat,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1,detail=16){const m=mesh(new THREE.SphereGeometry(r,detail,Math.max(8,detail/2)),mat,parent);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;}
function cylinderBetween(a,b,r,mat,parent){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A);const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat,parent);m.position.copy(A).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(up,d.normalize());return m;}
function textSprite(text,{size=3,color='#234946',background=null,width=256}={}){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=128;const c=canvas.getContext('2d');
 if(background){c.fillStyle=background;c.beginPath();c.roundRect(8,8,width-16,112,27);c.fill();}
 c.font='bold 65px Arial';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(text,width/2,67);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:true}));s.scale.set(size*width/128,size,1);return s;
}

function makePark(){
 const ground=mesh(new THREE.PlaneGeometry(380,280),material(0x9dad71));ground.rotation.x=-Math.PI/2;ground.position.y=-.15;
 const path=mesh(new THREE.PlaneGeometry(180,10),material(0xdbcb9e));path.rotation.x=-Math.PI/2;path.position.set(0,-.12,20);
 const grid=new THREE.GridHelper(150,30,0x829a67,0x93a571);grid.position.y=-.13;grid.material.transparent=true;grid.material.opacity=.18;scene.add(grid);
 const treeGreen=[material(0x517f51),material(0x75934e),material(0x668a58)];
 const rand=seed=>{let n=seed;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};};const random=rand(74);
 for(let i=0;i<60;i++){
  const x=-95+random()*195,z=-23-random()*40,h=3+random()*5;
  cylinderBetween([x,0,z],[x,h*.5,z],.23,mats.wood,scene);
  const crown=mesh(new THREE.ConeGeometry(h*.4,h,7),treeGreen[i%3]);crown.position.set(x,h*.8,z);
 }
 for(let i=0;i<11;i++){
  const m=mesh(new THREE.ConeGeometry(22+random()*18,26+random()*35,5),material(i%2?0xb8ac87:0xc9b897));m.position.set(-150+i*30,-2,-90-random()*20);m.rotation.y=random();
 }
 const white=material(0xfffdf1);
 for(let i=0;i<9;i++){
  const cloud=new THREE.Group();scene.add(cloud);cloud.position.set(-100+i*28,48+random()*20,-80-random()*35);
  for(let j=0;j<4;j++)ball(3.5,white,cloud,j*3-4,random()*2,0,1.5,.7,1,10);
 }
 // A small ferris wheel gives the park its silhouette without obscuring the track.
 const fw=new THREE.Group();fw.position.set(-40,13,-22);scene.add(fw);
 cylinderBetween([-45,0,-23],[-40,13,-22],.35,mats.support,scene);
 cylinderBetween([-35,0,-23],[-40,13,-22],.35,mats.support,scene);
 ferris=new THREE.Group();fw.add(ferris);
 const ring=mesh(new THREE.TorusGeometry(11,.23,8,72),mats.gold,ferris);
 for(let i=0;i<12;i++){
  const a=i/12*Math.PI*2,x=11*Math.cos(a),y=11*Math.sin(a);
  cylinderBetween([0,0,0],[x,y,0],.09,mats.support,ferris);
  const cabin=new THREE.Group();cabin.position.set(x,y,0);ferris.add(cabin);cabin.userData.cabin=true;
  box(1.7,.9,1.5,i%2?mats.red:mats.dark,cabin,0,-.6,0);box(1.9,.15,1.7,mats.gold,cabin,0,.6,0);
  for(const sx of [-.7,.7])cylinderBetween([sx,-.1,-.6],[sx,.6,-.6],.04,mats.support,cabin);
 }
 ball(1.4,mats.red,ferris,0,0,.3);const sign=textSprite('K',{size:2.3,color:'#fff4c6'});sign.position.set(0,0,1.5);fw.add(sign);
 // Park entrance and booths.
 for(const [x,z,color] of [[-20,-21,0xdc7861],[-8,-25,0xdbc66c],[65,-18,0x91a9b5]]){
  const b=new THREE.Group();b.position.set(x,0,z);scene.add(b);box(7,4,5,material(color),b,0,2,0);
  const roof=mesh(new THREE.ConeGeometry(5,2.4,4),mats.red,b);roof.position.y=5;roof.rotation.y=Math.PI/4;roof.scale.z=.8;
  box(2,2,.1,mats.dark,b,0,2,2.55);box(6,.3,1,mats.gold,b,0,3.5,3);
 }
 const gate=new THREE.Group();gate.position.set(-4,0,-27);scene.add(gate);
 cylinderBetween([-10,0,0],[-10,12,0],.25,mats.red,gate);cylinderBetween([10,0,0],[10,12,0],.25,mats.red,gate);
 const title=textSprite('KRUSTYLAND',{size:4,color:'#a63329',background:'#fff1bd',width:1024});title.position.set(0,12,0);gate.add(title);
 // A head-only sculpture extracted from the user's textured Krusty model.
 const landmark=new THREE.Group();landmark.position.set(52,0,-36);scene.add(landmark);
 const stone=material(0xc1a67b);
 for(let i=0;i<5;i++)ball(4.2,stone,landmark,-10+i*5,3,0,1.3,1,.85,9);
 box(11,9,7,stone,landmark,0,6,-2);
 const medallion=mesh(new THREE.CylinderGeometry(17.2,17.2,1,64),mats.dark,landmark);medallion.rotation.x=Math.PI/2;medallion.position.set(0,24,-5.5);
 const halo=mesh(new THREE.TorusGeometry(17.4,.45,10,96),mats.gold,landmark);halo.position.set(0,24,-4.7);
 for(let i=0;i<36;i++){const a=i/36*Math.PI*2;ball(.3,i%2?material(0xffe8a0,{emissive:0xffd15d,emissiveIntensity:.5}):mats.red,landmark,17.4*Math.cos(a),24+17.4*Math.sin(a),-4.5,1,1,1,10);}
 const krustySign=textSprite('KRUSTY',{size:2.5,color:'#fff5cd',background:'#bd4236',width:512});krustySign.position.set(0,9,4);landmark.add(krustySign);
 new GLTFLoader().load('./assets/Krusty-head.glb',gltf=>{
  const head=makeKrustyFace(gltf.scene);head.scale.set(23,23,8);head.position.set(0,12,.5);
  head.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});landmark.add(head);
 },undefined,error=>console.error('Krusty head',error));
 // Fence along the visitor path.
 for(let x=-75;x<85;x+=5){cylinderBetween([x,0,26],[x,2,26],.07,mats.dark,scene);}
 cylinderBetween([-75,1.4,26],[85,1.4,26],.06,mats.dark,scene);
}

function frameAt(s){
 const p=sampleTrack(track,s),T=new THREE.Vector3(...p.T),B=zaxis.clone().addScaledVector(T,-T.z).normalize(),U=B.clone().cross(T).normalize();
 return {P:new THREE.Vector3(...p.p),T,B,U};
}
function rebuildTrack(){
 if(trackGroup){scene.remove(trackGroup);trackGroup.traverse(o=>{o.geometry?.dispose();if(o.isSprite){o.material.map?.dispose();o.material.dispose();}});}
 trackGroup=new THREE.Group();scene.add(trackGroup);
 const points=[[],[],[]];const drawStart=track.drawStart||0,count=Math.ceil((track.length-drawStart)/.16);
 for(let i=0;i<=count;i++){
  const f=frameAt(drawStart+(track.length-drawStart)*i/count);
  points[0].push(f.P.clone().addScaledVector(f.B,.87));points[1].push(f.P.clone().addScaledVector(f.B,-.87));points[2].push(f.P.clone().addScaledVector(f.U,-.34));
 }
 for(let i=0;i<3;i++){
  const curve=new THREE.CatmullRomCurve3(points[i]);
  mesh(new THREE.TubeGeometry(curve,count,i===2?.22:.13,7,false),i===2?mats.rail:mats.railEdge,trackGroup);
 }
 const tieCount=Math.floor((track.length-drawStart)/.8),ties=new THREE.InstancedMesh(new THREE.BoxGeometry(2.1,.12,.2),mats.rail,tieCount);
 const temp=new THREE.Object3D();
 for(let i=0;i<tieCount;i++){
  const f=frameAt(drawStart+i*.8);basis.makeBasis(f.B.clone().negate(),f.U,f.T);temp.position.copy(f.P).addScaledVector(f.U,-.12);temp.quaternion.setFromRotationMatrix(basis);temp.updateMatrix();ties.setMatrixAt(i,temp.matrix);
 }ties.castShadow=true;trackGroup.add(ties);
 const supports=buildSupports(track),footMat=material(0x929e92),supportMetal=material(0x49716b,{metalness:.38,roughness:.5}),supportLight=material(0xb9c5b3,{metalness:.3,roughness:.55});
 for(const dark of [true,false]){
  const parts=supports.filter(s=>['ring','brace','mount'].includes(s.kind)===dark),instanced=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,10),dark?supportMetal:supportLight,parts.length);
  for(let i=0;i<parts.length;i++){const q=parts[i],a=new THREE.Vector3(...q.a),b=new THREE.Vector3(...q.b),direction=b.clone().sub(a);temp.position.copy(a).addScaledVector(direction,.5);temp.quaternion.setFromUnitVectors(up,direction.clone().normalize());temp.scale.set(q.r,direction.length(),q.r);temp.updateMatrix();instanced.setMatrixAt(i,temp.matrix);}
  instanced.castShadow=true;instanced.receiveShadow=true;trackGroup.add(instanced);
 }
 const feet=new Set();for(const support of supports){if(support.a[1]>.2)continue;const key=support.a.map(v=>v.toFixed(2)).join(',');if(feet.has(key))continue;feet.add(key);box(1.25,.28,1.25,footMat,trackGroup,support.a[0],.08,support.a[2]);}
 for(const point of track.landmarks){
  const f=frameAt(point.s),label=textSprite(point.id,{size:1.65,color:'#234946',background:'#fff9df',width:128});
  label.position.copy(f.P).addScaledVector(f.U,3.1).addScaledVector(f.B,1.6);trackGroup.add(label);
 }
 box(5,.3,5.2,mats.dark,trackGroup,-63.5,BASE+track.height-1.4,-.1);
 box(5,.1,5.4,mats.gold,trackGroup,-63.5,BASE+track.height-1.2,-.1);
 const startSign=textSprite('SALIDA',{size:1.7,color:'#fff9df',background:'#234946',width:512});startSign.position.set(-62,BASE+track.height+4,-2);trackGroup.add(startSign);
 // The arrival stays at ground level; the visible brake fins match the
 // horizontal braking zone used by the physics model.
 box(chosen.family?24:14,.35,3.5,mats.dark,trackGroup,chosen.family?64:68,BASE-.85,11.1);
 box(chosen.family?24:14,.1,3.7,mats.gold,trackGroup,chosen.family?64:68,BASE-.63,11.1);
 for(let x=47;x<74;x+=1.5){
  box(.7,.25,.12,mats.steel,trackGroup,x,BASE-.05,7.22);
  box(.7,.25,.12,mats.steel,trackGroup,x,BASE-.05,7.98);
 }
 const arrival=textSprite('LLEGADA',{size:1.8,color:'#fff9df',background:'#234946',width:512});arrival.position.set(72,BASE+4,12.7);trackGroup.add(arrival);
 const brakes=textSprite('FRENOS',{size:1.3,color:'#234946',background:'#f2c94c',width:512});brakes.position.set(52,BASE+2.7,11.8);trackGroup.add(brakes);
}

function makeCart(person=null){
 const c=new THREE.Group();scene.add(c);c.name='Krusty Comet · carrito de un asiento';
 const child=!!person&&person.height<1.4,barHeight=child?1.52:1.17;
 box(1.95,.18,3.1,mats.dark,c,0,.4,0);
 // Beveled open cockpit, rather than a solid block through the passenger.
 const body=new THREE.Shape();body.moveTo(-.88,1.48);body.lineTo(.88,1.48);body.quadraticCurveTo(1.12,1.48,1.12,1.22);body.lineTo(1.12,-1.12);body.quadraticCurveTo(1.1,-1.85,0,-1.9);body.quadraticCurveTo(-1.1,-1.85,-1.12,-1.12);body.lineTo(-1.12,1.22);body.quadraticCurveTo(-1.12,1.48,-.88,1.48);
 const hole=new THREE.Path();hole.moveTo(-.8,-.9);hole.lineTo(-.8,1.12);hole.lineTo(.8,1.12);hole.lineTo(.8,-.9);hole.closePath();body.holes.push(hole);
 const shell=mesh(new THREE.ExtrudeGeometry(body,{depth:.6,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.065,bevelThickness:.065,curveSegments:16}),mats.red,c);shell.rotation.x=-Math.PI/2;shell.position.y=.54;
 box(1.55,.12,2,mats.black,c,0,.57,0);
 for(const x of [-1.14,1.14]){
  box(.055,.1,2.6,mats.gold,c,x,1.09,-.04);
  for(const z of [-1.15,-.6,.2,.9])ball(.035,mats.steel,c,x*1.01,.77,z,1,1,1,8);
 }
 for(const x of [-.26,.26])box(.13,.035,.65,mats.gold,c,x,1.215,1.37);
 box(1.22,.2,1.18,mats.seat,c,0,1.02,-.34);
 for(const x of [-.59,.59])box(.07,.09,1.05,mats.gold,c,x,1.1,-.33);
 const booster=box(1.05,.35,1,mats.seat,c,0,1.29,-.35);booster.visible=!!person&&person.height<1.4;c.userData.booster=booster;
 const back=box(1.29,1.28,.26,mats.seat,c,0,1.62,-1.04);back.rotation.x=-.1;
 ball(.36,mats.seat,c,0,2.18,-1.03,1.3,.65,.5,20);
 // Low padded lap restraint leaves faces and shoulders unobstructed.
 for(const x of [-.55,.55]){
  const points=[[x,.99,-.84],[x,child?1.29:1.02,-.25],[x,barHeight,.46]].map(a=>new THREE.Vector3(...a));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.075,8,false),mats.gold,c);
 }
 cylinderBetween([-.55,barHeight,.46],[.55,barHeight,.46],.075,mats.gold,c);
 box(.38,.21,.18,mats.dark,c,0,barHeight,.47);
 const footY=person?({Homero:.70,Marge:.80,Bart:1.15,Lisa:1.17}[person.name]):.70;
 if(footY)box(.85,.08,.55,mats.dark,c,0,footY-.05,.30);
 for(const x of [-.91,.91])for(const z of [-1.12,1.12]){
  const wheel=mesh(new THREE.CylinderGeometry(.28,.28,.22,24),mats.black,c);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.23,z);wheel.userData.spinRadius=.28;wheel.userData.spinBase=wheel.quaternion.clone();
  for(let j=0;j<3;j++){const spoke=box(.38,.025,.035,mats.gold,wheel,0,-Math.sign(x)*.145,0);spoke.rotation.y=j*Math.PI/3;}
  const hub=mesh(new THREE.CylinderGeometry(.14,.14,.24,16),mats.gold,c);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);hub.userData.spinRadius=.28;hub.userData.spinBase=hub.quaternion.clone();
  const under=mesh(new THREE.CylinderGeometry(.15,.15,.18,16),mats.black,c);under.rotation.z=Math.PI/2;under.position.set(x,-.24,z);under.userData.spinRadius=.15;under.userData.spinBase=under.quaternion.clone();
  const guide=mesh(new THREE.CylinderGeometry(.16,.16,.12,16),mats.black,c);guide.position.set(Math.sign(x)*1.17,-.02,z);guide.userData.spinRadius=.16;guide.userData.spinDirection=Math.sign(x);guide.userData.spinBase=guide.quaternion.clone();
  cylinderBetween([x,.4,z],[x,-.25,z],.065,mats.steel,c);
 }
 const lamp=material(0xfff7cc,{emissive:0xffdf93,emissiveIntensity:.7,roughness:.25});
 for(const x of [-.52,.52]){ball(.16,mats.steel,c,x,1.01,1.64,1,1,.4,20);ball(.12,lamp,c,x,1.01,1.71,1,1,.35,20);ball(.09,mats.red,c,x,.89,-1.53,1,1,.4,14);}
 cylinderBetween([-1.1,.68,1.15],[0,.68,1.93],.065,mats.steel,c);cylinderBetween([0,.68,1.93],[1.1,.68,1.15],.065,mats.steel,c);
 const badge=textSprite('K★',{size:.38,color:'#234946',background:'#f2c94c',width:256});badge.position.set(0,.96,1.94);c.add(badge);
 c.userData.wheels=[];c.traverse(o=>{if(o.userData.spinRadius)c.userData.wheels.push(o);});
 return c;
}

function disposeVehicle(vehicle){
 scene.remove(vehicle.car);vehicle.car.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.isSkinnedMesh)o.skeleton.dispose();if(o.isSprite){o.material.map?.dispose();o.material.dispose();}});
}
async function loadPassengers(){
 const request=++characterRequest;$('boardingStatus').textContent=chosen.family?'Subiendo a toda la familia…':'Subiendo a '+chosen.name+'…';
 for(const v of vehicles)disposeVehicle(v);for(const c of couplers){scene.remove(c);c.geometry.dispose();}couplers=[];
 vehicles=activePeople().map((person,i)=>({person,offset:i*4.6,car:makeCart(person),passenger:null,rig:null}));car=vehicles[0].car;
 for(let i=1;i<vehicles.length;i++){const c=mesh(new THREE.CylinderGeometry(.075,.075,1,12),mats.steel);couplers.push(c);}
 updateCar(sim.snapshot(),1);
 try{
  const originals=await Promise.all(vehicles.map(async v=>{let o=cache.get(v.person.name);if(!o){o=(await new GLTFLoader().loadAsync(`./assets/${v.person.name}.glb`)).scene;cache.set(v.person.name,o);}return o;}));
  if(request!==characterRequest)return;
  vehicles.forEach((v,i)=>{const r=rigModel(originals[i],v.person);v.passenger=r.root;v.rig=r.rig;v.passenger.visible=cameraMode!=='ride'||i!==0;v.car.add(v.passenger);});
  passenger=vehicles[0].passenger;passengerRig=vehicles[0].rig;
  $('boardingStatus').textContent=chosen.family?'Familia completa a bordo · 5 asientos':chosen.name+' está a bordo · un asiento';
 }catch(error){if(request!==characterRequest)return;console.error(error);$('boardingStatus').textContent='No se pudieron cargar todos los pasajeros';toast('No se pudieron cargar todos los personajes. Puedes continuar con los carritos.');}
}

function initScene(){
 const host=$('scene');
 try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});}
 catch(error){$('loading').innerHTML='Tu navegador no pudo iniciar WebGL. Los datos y controles siguen disponibles.';console.error(error);return;}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0xcce1e4);host.appendChild(renderer.domElement);
 scene=new THREE.Scene();scene.background=new THREE.Color(0xcce1e4);scene.fog=new THREE.Fog(0xcce1e4,140,290);
 scene.add(new THREE.HemisphereLight(0xfff6d8,0x71907a,2.3));
 const sun=new THREE.DirectionalLight(0xffe6bd,3);sun.position.set(-35,65,45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-90,right:90,top:65,bottom:-65,near:1,far:180});sun.shadow.bias=-.001;sun.shadow.normalBias=.1;scene.add(sun);
 camera=new THREE.PerspectiveCamera(45,1,.1,600);
 orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.minDistance=7;orbit.maxDistance=240;orbit.maxPolarAngle=Math.PI*.49;orbit.target.set(0,14,4);
 makePark();rebuildTrack();scene.add(vectorGroup);
 for(const color of [0xd94b37,0x4b8dbb,0xa15db4,0xc79317])vectorGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),3,color,.55,.25));
 loadPassengers();sceneReady=true;resizeScene();setCamera('boarding',true);updateCar(sim.snapshot(),1);
 renderer.render(scene,camera);$('loading').classList.add('hidden');
}

function resizeScene(){
 if(!renderer)return;const rect=$('scene').getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
}
function setCamera(mode,instant=false){
 cameraMode=mode;document.querySelectorAll('[data-camera]').forEach(b=>{b.classList.toggle('selected',b.dataset.camera===mode);b.setAttribute('aria-pressed',String(b.dataset.camera===mode));});
 $('sceneHint').textContent=mode==='boarding'?'Vista de embarque · el pasajero y su carrito':mode==='orbit'?'Arrastra para girar · rueda para acercarte':mode==='side'?'Vista lateral para observar altura y trayectoria':mode==='follow'?'Cámara de seguimiento del carrito':'POV desde el asiento · la cámara gira con el carrito en cada vuelta';
 document.querySelector('.scene-caption').textContent=mode==='ride'?'POV / PRIMERA PERSONA':'PISTA EXPERIMENTAL / 3D';
 vehicles.forEach((v,i)=>{if(v.passenger)v.passenger.visible=mode!=='ride'||i!==0;});
 if(!sceneReady)return;
 camera.fov=mode==='ride'?76:mode==='boarding'?(chosen.family?48:42):chosen.family&&mode==='follow'?52:45;camera.near=mode==='ride'?.06:.1;camera.updateProjectionMatrix();
 orbit.enabled=mode==='orbit';
 if(mode==='orbit'){
  const d=Math.max(chosen.family?120:105,(chosen.family?180:155)/Math.max(.9,camera.aspect));camera.position.set(22,track.height*.65+22,d);camera.up.set(0,1,0);orbit.target.set(chosen.family?-4:2,track.height*.37+3,4);orbit.update();
 }
 if(instant){const f=frameAt(sim.s);cameraAim.copy(f.P).addScaledVector(f.U,1.35);if(mode!=='orbit')updateCamera(sim.snapshot(),1);}
}

function updateCamera(state,alpha){
 if(!camera||cameraMode==='orbit'){orbit?.update();return;}
 const f=frameAt(state.s);let pos,target,camUp=up;
 if(cameraMode==='boarding'){const center=chosen.family?frameAt(state.s-9.2):f,scale=Math.max(1,(chosen.family?1.35:.85)/camera.aspect);pos=center.P.clone().addScaledVector(center.B,(chosen.family?19:4.3)*scale).addScaledVector(center.U,(chosen.family?8:3.0)*scale).addScaledVector(center.T,(chosen.family?10:6.2)*scale);target=center.P.clone().addScaledVector(center.U,1.35);camUp=center.U;}
 else if(cameraMode==='side'){const x=chosen.family?-4:3;pos=new THREE.Vector3(x,track.height*.43+3,Math.max(chosen.family?125:110,(chosen.family?175:150)/camera.aspect));target=new THREE.Vector3(x,track.height*.43+3,4);}
 else if(cameraMode==='follow'){
  const center=chosen.family?frameAt(state.s-9.2):f,scale=chosen.family?Math.max(1,1.35/camera.aspect):1;
  pos=center.P.clone().addScaledVector(center.B,(chosen.family?20:9)*scale).add(new THREE.Vector3(chosen.family?-10:-7,chosen.family?8:5,0));
  target=center.P.clone().addScaledVector(center.U,1.25);camUp=up;
 }else{
  const eyeHeight=chosen.height<1.4?1.94:2.08;
  pos=f.P.clone().addScaledVector(f.U,eyeHeight).addScaledVector(f.T,.32);
  const ahead=frameAt(Math.min(track.length,state.s+3));
  target=pos.clone().addScaledVector(f.T,9).addScaledVector(ahead.T,2);camUp=f.U;
 }
 const k=cameraMode==='ride'?1:Math.min(1,alpha);camera.position.lerp(pos,k);camera.up.copy(camUp);cameraAim.lerp(target,k);
 cameraLookMatrix.lookAt(camera.position,cameraMode==='ride'?target:cameraAim,camera.up);cameraLookQ.setFromRotationMatrix(cameraLookMatrix);camera.quaternion.slerp(cameraLookQ,k);
}
function updateCar(state,alpha,visualTime=performance.now()/1000,dt=.016){
 if(!car)return;const f=frameAt(state.s);
 for(const [i,v] of vehicles.entries()){
  const vf=frameAt(state.s-v.offset);basis.makeBasis(vf.B.clone().negate(),vf.U,vf.T);v.car.position.copy(vf.P).addScaledVector(vf.U,.03);v.car.quaternion.setFromRotationMatrix(basis);
  if(v.rig)animatePassenger(v.rig,state,visualTime+i*.27,dt,reducedMotion);
  for(const wheel of v.car.userData.wheels||[]){wheelQ.setFromAxisAngle(up,-state.s/wheel.userData.spinRadius*(wheel.userData.spinDirection||1));wheel.quaternion.copy(wheel.userData.spinBase).multiply(wheelQ);}
  if(i){const front=frameAt(state.s-vehicles[i-1].offset),a=front.P.clone().addScaledVector(front.U,.38).addScaledVector(front.T,-1.7),b=vf.P.clone().addScaledVector(vf.U,.38).addScaledVector(vf.T,1.97),d=b.clone().sub(a),joint=couplers[i-1];joint.position.copy(a).addScaledVector(d,.5);joint.quaternion.setFromUnitVectors(up,d.clone().normalize());joint.scale.set(1,d.length(),1);}
 }

 const origin=new THREE.Vector3(...state.p).addScaledVector(f.U,1.6).addScaledVector(f.B,1.4);
 const vectors=[new THREE.Vector3(0,-G,0),new THREE.Vector3(...state.reaction),new THREE.Vector3(...state.frictionVector),new THREE.Vector3(...state.velocityVector)];
 vectorGroup.visible=$('vectors').checked;
 vectorGroup.children.forEach((arrow,i)=>{const v=vectors[i],length=v.length();arrow.visible=length>.01;if(length>.01){arrow.position.copy(origin);arrow.setDirection(v.normalize());arrow.setLength(Math.min(7,1.2+Math.log1p(length)*.8),.5,.23);}});
 updateCamera(state,alpha);
}

function resetSimulation(rebuild=true){
 playing=false;
 if(rebuild){track=buildTrack({height:+$('height').value,radius:+$('radius').value});track.drawStart=chosen.family?-20.4:0;if(sceneReady)rebuildTrack();}
 const mu=$('frictionEnabled').checked?+$('friction').value:0;sim=new Simulator(track,{mass:vehicleMass()+riderMass(),mu,cars:chosen.family?people.map((p,i)=>({mass:55+familyMasses[p.name],offset:i*4.6})):null});
 $('boardingName').textContent=chosen.family?'Familia Simpson':chosen.name+' Simpson';$('boardingMass').textContent=sim.mass+' kg '+(chosen.family?'con los 5 carros':'con carrito');$('cartMassValue').textContent=vehicleMass()+' kg';
 $('massOut').textContent=riderMass()+' kg';$('totalMass').textContent=sim.mass+' kg';$('heightOut').textContent=$('height').value+' m';$('radiusOut').textContent=fmt(+$('radius').value,1)+' m';$('frictionOut').textContent=fmt(+$('friction').value,3);
 updateUI();drawCharts();if(sceneReady){updateCar(sim.snapshot(),1);if(cameraMode==='orbit')setCamera('orbit');}
}
function updateUI(){
 const s=sim.snapshot(),convert=unit==='specific'?s.m:1;
 $('speedValue').innerHTML=fmt(s.v)+' <span>m/s</span>';$('heightValue').innerHTML=fmt(s.h)+' <span>m</span>';$('loadValue').innerHTML=fmt(s.load)+' <span>g</span>';$('timeValue').innerHTML=fmt(s.t)+' <span>s</span>';
 const shownUnit=unit==='specific'?'J/kg':'kJ',factor=unit==='specific'?s.m:1000;
 for(const [id,key] of [['epValue','Ep'],['ecValue','Ec'],['emValue','Em'],['qValue','Q']])$(id).innerHTML=fmt(s[key]/factor)+` <small>${shownUnit}</small>`;
 const pill=$('statusPill');pill.classList.toggle('running',playing);
 const text=sim.finished?'LLEGADA · RECORRIDO COMPLETO':sim.stopped?'EN REPOSO':playing?(sim.braking?'FRENANDO EN LA LLEGADA':s.signedV<-.01?'RECORRIDO DE REGRESO':'EN MOVIMIENTO'):s.t?'EN PAUSA':'LISTO PARA SALIR';pill.innerHTML='<i></i>'+text;
 $('play').innerHTML=playing?'<span>Ⅱ</span> Pausar recorrido':`<span>▶</span> ${s.t?'Continuar recorrido':'¡A la pista!'}`;
 $('play').disabled=sim.stopped;$('step').disabled=playing||sim.stopped;
 $('sectionValue').textContent=s.section;
 $('balance').textContent='Δ '+fmt(Math.abs(s.error)/(sim.e0*sim.mass)*100,3)+' %';
 $('pointCount').textContent=sim.checkpoints.length+' / '+track.landmarks.length;
 for(const id of ['epHeading','ecHeading','emHeading','qHeading']){
  const label={epHeading:'Eₚ',ecHeading:'E꜀',emHeading:'Eₘ',qHeading:'Q'}[id];$(id).innerHTML=label+` <small>${unit==='specific'?'J/kg':'J'}</small>`;
 }
 $('pointRows').innerHTML=track.landmarks.map(p=>{
  const c=sim.checkpoints.find(x=>x.id===p.id);
  return `<tr class="${c?'':'pending'}"><td><b>${p.id}</b>${p.name}</td>${c?[c.t,c.h,c.v,c.Ep/convert,c.Ec/convert,c.Em/convert,c.Q/convert].map(x=>`<td>${fmt(x)}</td>`).join(''):'<td>—</td>'.repeat(7)}</tr>`;
 }).join('');
}

function chart(canvas,lines,{yLabel='',secondLabel='',fixedMax=0}={}){
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const ratio=Math.min(devicePixelRatio||1,2);canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;
 const c=canvas.getContext('2d');c.scale(ratio,ratio);const W=rect.width,H=rect.height,L=42,R=secondLabel?35:14,T=24,B=26;
 const pw=W-L-R,ph=H-T-B,maxTime=Math.max(10,Math.ceil(sim.t/5)*5),data=sim.samples;
 const maxima=lines.map(line=>Math.max(.001,fixedMax,...data.map(s=>line.value(s))));
 const yMax=fixedMax||Math.ceil(Math.max(...maxima)*1.08/5)*5;
 const secondMax=lines.length>1&&secondLabel?Math.max(5,Math.ceil(maxima[1]*1.08/5)*5):yMax;
 c.font='9px Arial';c.lineWidth=1;c.fillStyle='#8b9782';c.textAlign='left';c.fillText(yLabel,L,11);
 if(secondLabel){c.textAlign='right';c.fillText(secondLabel,W-R,11);}
 for(let i=0;i<=4;i++){
  const y=T+ph*i/4;c.strokeStyle='#e9ecdf';c.beginPath();c.moveTo(L,y);c.lineTo(W-R,y);c.stroke();
  c.fillStyle='#8a9680';c.textAlign='right';const n=yMax*(1-i/4);c.fillText(n>=1000?fmt(n/1000,1)+'k':fmt(n,n<10?1:0),L-7,y+3);
  if(secondLabel){c.textAlign='left';c.fillText(fmt(secondMax*(1-i/4),0),W-R+6,y+3);}
 }
 for(let i=0;i<=4;i++){const x=L+pw*i/4;c.textAlign='center';c.fillStyle='#8a9680';c.fillText(fmt(maxTime*i/4,0),x,H-8);}
 c.textAlign='right';c.fillText('t / s',W-R,H-8);
 lines.forEach((line,j)=>{
  c.strokeStyle=line.color;c.lineWidth=line.dashed?1.3:1.9;c.setLineDash(line.dashed?[4,4]:[]);c.beginPath();
  data.forEach((s,i)=>{const x=L+pw*s.t/maxTime,y=T+ph*(1-line.value(s)/(j===1&&secondLabel?secondMax:yMax));if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();
  if(data.length){const last=data.at(-1),x=L+pw*last.t/maxTime,y=T+ph*(1-line.value(last)/(j===1&&secondLabel?secondMax:yMax));c.fillStyle=line.color;c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();}
 });c.setLineDash([]);
}
function drawCharts(){
 if(!sim)return;const div=unit==='specific'?sim.mass:1;
 chart($('energyChart'),[
  {color:'#4b8dbb',value:s=>s.Ep/div},{color:'#c79317',value:s=>s.Ec/div},
  {color:'#28786d',value:s=>s.Em/div},{color:'#df543c',value:s=>s.Q/div},
  {color:'#183c3b',value:s=>s.total/div,dashed:true}
 ],{yLabel:unit==='specific'?'E / J/kg':'E / J',fixedMax:Math.ceil(sim.e0*sim.mass/div*1.06/10)*10});
 chart($('motionChart'),[{color:'#c79317',value:s=>s.v},{color:'#4b8dbb',value:s=>s.h}],{yLabel:'v / m/s',secondLabel:'h / m'});
}

function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('play').onclick=()=>{if(!playing&&cameraMode==='boarding')setCamera('follow',true);playing=!playing;updateUI();};
$('reset').onclick=()=>{resetSimulation(false);toast('Prueba reiniciada');};
$('step').onclick=()=>{if(cameraMode==='boarding')setCamera('follow',true);sim.advance(.1);updateUI();drawCharts();if(sceneReady)updateCar(sim.snapshot(),1);};
let rebuildTimer;
for(const id of ['height','radius'])$(id).addEventListener('input',()=>{playing=false;$('heightOut').textContent=$('height').value+' m';$('radiusOut').textContent=fmt(+$('radius').value,1)+' m';clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>resetSimulation(true),90);});
$('mass').addEventListener('input',()=>resetSimulation(false));
$('friction').addEventListener('input',()=>resetSimulation(false));
$('frictionEnabled').onchange=()=>{$('friction').disabled=!$('frictionEnabled').checked;$('frictionControls').classList.toggle('muted-control',!$('frictionEnabled').checked);resetSimulation(false);};
$('vectors').onchange=()=>{if(sceneReady)updateCar(sim.snapshot(),1);};
$('units').onchange=()=>{unit=$('units').value;updateUI();drawCharts();};
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>setCamera(b.dataset.camera,true));
function exportResults(){
 const rows=[['# Krustyland laboratorio de energia','g=9.81','carrito_kg='+(55*(sim.cars?.length||1)),'pasajero='+chosen.name,'masa_total_kg='+sim.mass,'altura_salida_m='+track.height,'radio_vuelta1_m='+track.radius,'mu='+sim.mu,'modo='+(chosen.family?'familia':'individual'),'altura='+(chosen.family?'centro_de_masa':'punto_del_riel')],
 ['t_s','s_m','h_m','v_m_s','masa_kg','Ep_J','Ec_J','Em_J','Q_J','Etotal_J','Ep_J_kg','Ec_J_kg','Em_J_kg','Q_J_kg','normal_N','carga_g','friccion_N','a_t_m_s2','a_c_m_s2','curvatura_1_m','error_balance_J','tramo','Q_rozamiento_J','Q_frenos_J','freno_N','h_primer_carro_m']];
 const samples=[...sim.samples];if(sim.t-samples.at(-1).t>1e-6)samples.push(sim.snapshot());
 for(const s of samples)rows.push([s.t,s.s,s.h,s.v,s.m,s.Ep,s.Ec,s.Em,s.Q,s.total,s.Ep/s.m,s.Ec/s.m,s.Em/s.m,s.Q/s.m,s.N,s.load,s.Ff,s.at,s.ac,s.kappa,s.error,s.section,s.Qfriction,s.Qbrake,s.Fbrake,s.hLead].map(x=>typeof x==='number'?x.toFixed(7):x));
 download(new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8'}),`Krustyland_${chosen.name}_${sim.mass}kg_mu${sim.mu}.csv`);toast('Resultados CSV descargados');
}
$('export').onclick=exportResults;$('exportQuick').onclick=exportResults;
function exportCanvas(canvas,name){
 canvas.toBlob(blob=>{if(blob){download(blob,name);toast('Imagen PNG descargada');}else toast('No se pudo crear la imagen. Inténtalo de nuevo.');},'image/png');
}
function rounded(c,x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function captureHeader(c,W,s,title){
 c.fillStyle='#183c3b';c.fillRect(0,0,W,122);c.fillStyle='#f2cb52';c.font='bold 17px Arial';c.fillText('KRUSTYLAND  /  PRÁCTICA 6',38,35);c.fillStyle='#fff6d6';c.font='bold 32px Arial';c.fillText(title,38,77);c.fillStyle='#b6c8b5';c.font='15px Arial';c.fillText(`${chosen.family?'Familia Simpson':chosen.name} · masa total ${fmt(s.m,0)} kg · altura inicial ${fmt(track.height,0)} m · μ ${fmt(sim.mu,3)} · t ${fmt(s.t)} s`,38,105);
}
$('snapshot').onclick=()=>{
 if(!renderer){toast('La escena 3D todavía no está disponible.');return;}
 const state=sim.snapshot();renderer.render(scene,camera);
 const out=document.createElement('canvas'),W=Math.max(1400,Math.min(2000,renderer.domElement.width)),sceneH=Math.round(W*renderer.domElement.height/renderer.domElement.width);out.width=W;out.height=sceneH+306;
 const c=out.getContext('2d');captureHeader(c,W,state,'Energía mecánica · captura del simulador');c.drawImage(renderer.domElement,0,122,W,sceneH);c.fillStyle='#f8f6ed';c.fillRect(0,122+sceneH,W,184);
 const stats=[['RAPIDEZ',fmt(state.v)+' m/s'],[chosen.family?'ALTURA DEL CM':'ALTURA',fmt(state.h)+' m'],['CARGA NORMAL',fmt(state.load)+' g'],['TRAMO',state.section]];
 const dx=(W-76)/4;stats.forEach(([name,value],i)=>{const x=38+i*dx,y=sceneH+154;c.fillStyle='#75826c';c.font='bold 12px Arial';c.fillText(name,x,y);c.fillStyle='#183c3b';c.font='25px Arial';c.fillText(value,x,y+35);});
 const es=[['Potencial',state.Ep,'#4b8dbb'],['Cinética',state.Ec,'#c79317'],['Mecánica',state.Em,'#28786d'],['Disipada',state.Q,'#df543c']];es.forEach(([name,value,color],i)=>{const x=38+i*dx,y=sceneH+226;rounded(c,x,y,dx-16,49,8,'#eeefdf');c.fillStyle=color;c.font='bold 14px Arial';c.fillText(name,x+13,y+20);c.fillStyle='#183c3b';c.font='18px Arial';c.fillText(fmt(value/1000)+' kJ',x+13,y+41);});
 c.fillStyle='#8b947e';c.font='11px Arial';c.fillText('Modelo didáctico · Eₘ + Q = E₀ · '+new Date().toLocaleString('es-GT'),38,out.height-12);
 exportCanvas(out,`Krustyland_captura_${chosen.name}_${state.t.toFixed(2)}s.png`);
};
$('exportCharts').onclick=()=>{
 drawCharts();const state=sim.snapshot(),out=document.createElement('canvas');out.width=1600;out.height=1120;const c=out.getContext('2d');c.fillStyle='#f8f6ed';c.fillRect(0,0,1600,1120);captureHeader(c,1600,state,'Resultados · gráficas de la prueba');
 const graphs=[['Balance de energía','energyChart'],['Rapidez y altura','motionChart']];graphs.forEach(([name,id],i)=>{const y=148+i*441;rounded(c,28,y,1544,421,14,'#fffef9');c.fillStyle='#183c3b';c.font='bold 22px Arial';c.fillText(name,50,y+36);c.drawImage($(id),45,y+52,1510,345);});
 const labels=[['Potencial','#4b8dbb'],['Cinética / rapidez','#c79317'],['Mecánica','#28786d'],['Disipada','#df543c'],['Total','#183c3b']];labels.forEach(([name,color],i)=>{c.fillStyle=color;c.fillRect(45+i*275,1048,13,13);c.font='17px Arial';c.fillText(name,65+i*275,1061);});
 c.fillStyle='#73816e';c.font='15px Arial';c.fillText(`Energía en ${unit==='specific'?'J/kg':'J'} · rapidez en m/s · altura en m · error de balance ${fmt(Math.abs(state.error)/(sim.e0*sim.mass)*100,4)} %`,45,1100);
 exportCanvas(out,`Krustyland_graficas_${chosen.name}_${state.t.toFixed(2)}s.png`);
};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.scene-card').requestFullscreen();}catch{toast('Tu navegador no permite pantalla completa en esta vista.');}};
document.addEventListener('visibilitychange',()=>{lastTime=0;});
window.addEventListener('introopened',()=>{playing=false;updateUI();});
window.addEventListener('introclosed',()=>{lastTime=0;resizeScene();drawCharts();});
document.addEventListener('keydown',e=>{if(!document.getElementById('introScreen').hidden)return;if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','SUMMARY'].includes(document.activeElement.tagName)){e.preventDefault();$('play').click();}});

function animate(now){
 requestAnimationFrame(animate);const dt=lastTime?Math.min((now-lastTime)/1000,.06):0;lastTime=now;
 if(playing&&dt){sim.advance(dt*+$('rate').value);if(sim.stopped)playing=false;}
 if(sceneReady){
  updateCar(sim.snapshot(),1-Math.exp(-dt*9),now/1000,dt);
  if(ferris){ferris.rotation.z=now*.000035;ferris.children.forEach(o=>{if(o.userData.cabin)o.rotation.z=-ferris.rotation.z;});}
  renderer.render(scene,camera);
 }
 if(now-lastPaint>90){updateUI();drawCharts();lastPaint=now;}
 if(sim.t>=90&&playing){playing=false;toast('Prueba de 90 s completada. Exporta los datos o reinicia.');}
}

track=buildTrack();sim=new Simulator(track,{mass:155,mu:0});
initScene();updateUI();drawCharts();observer.observe($('scene'));observer.observe($('energyChart'));observer.observe($('motionChart'));requestAnimationFrame(animate);
