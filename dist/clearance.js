import {sampleTrack,BASE} from './physics.js';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
export function trackFrame(track,s){
 const f=sampleTrack(track,s),T=f.T,B=unit([0,0,1].map((v,i)=>v-T[i]*T[2])),U=unit(cross(B,T));return {...f,B,U};
}
// Separate main shell/passenger and four wheel assemblies so supports can
// attach to the rail's center spine through the actual gap below the car.
export const VEHICLE_BOXES=[
 {center:[0,1.65,0],half:[1.4,1.38,2.08]},
 ...[-.98,.98].flatMap(x=>[-1.12,1.12].map(z=>({center:[x,.12,z],half:[.44,.58,.5]})))
];
export function clearanceFrames(track){
 const frames=[];for(let s=track.drawStart||0;s<track.length;s+=.2)frames.push(trackFrame(track,s));frames.push(trackFrame(track,track.length));return frames;
}
export function segmentClear(a,b,frames,radius=.2){
 const delta=sub(b,a);
 for(const f of frames){
  const axes=[f.B,f.U,f.T],offset=sub(a,f.p),pa=axes.map(axis=>dot(offset,axis)),direction=axes.map(axis=>dot(delta,axis));
  for(const box of VEHICLE_BOXES){
   let lo=0,hi=1;
   for(let i=0;i<3;i++){
    const x=pa[i]-box.center[i],d=direction[i],h=box.half[i]+radius+.13;
    if(Math.abs(d)<1e-10){if(Math.abs(x)>h){lo=2;break;}continue;}
    let u=(-h-x)/d,v=(h-x)/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)break;
   }
   if(lo<=hi&&hi>=0&&lo<=1)return false;
  }
 }
 return true;
}
export function buildSupports(track){
 const frames=clearanceFrames(track),segments=[];
 const add=(a,b,r=.16,kind='column',trusted=false)=>{if(trusted||segmentClear(a,b,frames,r))segments.push({a,b,r,kind});};
 const mount=(f,offset)=>f.p.map((v,i)=>v-f.U[i]*offset);
 const top=BASE+track.height-1.4;
 for(const x of [-65.5,-62])for(const z of [-2.65,2.65])add([x,.1,z],[x,top,z],.23,'tower');
 for(let y=0;y<top-1;y+=8){const next=Math.min(top,y+8);for(const z of [-2.65,2.65]){add([-65.5,y+.1,z],[-62,next,z],.09,'brace');add([-62,y+.1,z],[-65.5,next,z],.09,'brace');}for(const x of [-65.5,-62])add([x,next,-2.65],[x,next,2.65],.12,'beam');}
 const start=trackFrame(track,0);add([-62,top,0],mount(start,.62),.16,'beam');
 function bent(s){
  const f=trackFrame(track,s),p=mount(f,1.1);if(p[1]<1)return;
  const a=[p[0],p[1],f.p[2]-3],b=[p[0],p[1],f.p[2]+3];
  const pieces=[{a:[a[0],.1,a[2]],b:a,r:.23,kind:'column'},{a:[b[0],.1,b[2]],b,r:.23,kind:'column'},{a,b,r:.19,kind:'beam'}];
  if(!pieces.every(q=>segmentClear(q.a,q.b,frames,q.r)))return;
  segments.push(...pieces);add(p,mount(f,.62),.14,'mount');
  if(p[1]>7){add([a[0],p[1]*.15,a[2]],b,.1,'brace');add([b[0],p[1]*.15,b[2]],a,.1,'brace');}
 }
 for(let s=(track.drawStart||0)+3;s<0;s+=9)bent(s);
 const descent=track.ranges.find(r=>r.name==='Descenso');for(let s=13;s<descent.end-5;s+=13)bent(s);
 for(const [name,x,r] of [['Vuelta 1',0,track.radius],['Vuelta 2',30,track.radius*.85]]){
  const cy=BASE+r,rr=r+1.25,z=-5,range=track.ranges.find(a=>a.name===name),ringPoint=q=>[x+rr*Math.sin(q),cy-rr*Math.cos(q),z];
  // These back-frame segments stay entirely behind all rail lanes.
  for(let i=0;i<80;i++)add(ringPoint(i/80*Math.PI*2),ringPoint((i+1)/80*Math.PI*2),.22,'ring',true);
  for(const side of [-1,1]){
   const bottom=[x+side*r*.72,cy-Math.sqrt(rr*rr-(r*.72)**2),z],foot=[bottom[0],.1,z];add(foot,bottom,.25,'column',true);
   add([x+side*(rr+2),.1,z],[x+side*rr,cy,z],.19,'brace',true);
  }
  for(const t of [.08,.18,.32,.43,.57,.68,.82,.92]){
   const q=t*Math.PI*2,f=trackFrame(track,range.start+(range.end-range.start)*t),joint=mount(f,1.25),end=mount(f,.62),back=ringPoint(q);
   if(segmentClear(back,joint,frames,.14)&&segmentClear(joint,end,frames,.14)){segments.push({a:back,b:joint,r:.14,kind:'mount'},{a:joint,b:end,r:.14,kind:'mount'});}
  }
 }
 const hill=track.ranges.filter(r=>r.name==='Colina');bent((hill[0].start+hill.at(-1).end)/2);
 const arrival=track.ranges.find(r=>r.name==='Recta de llegada');
 for(let s=arrival.start+3;s<track.length;s+=7){const f=trackFrame(track,s),p=mount(f,.62);add([p[0],.1,p[2]],p,.16,'pier');}
 return segments;
}
