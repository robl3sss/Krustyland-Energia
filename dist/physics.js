export const G = 9.81;
export const BASE = 2;
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,k)=>a.map(x=>x*k);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const len=a=>Math.hypot(...a);
const unit=a=>mul(a,1/(len(a)||1));
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const cubic=(p,t)=>{
  const u=1-t;
  const v=add(add(mul(p[0],u*u*u),mul(p[1],3*u*u*t)),add(mul(p[2],3*u*t*t),mul(p[3],t*t*t)));
  const d=add(add(mul(sub(p[1],p[0]),3*u*u),mul(sub(p[2],p[1]),6*u*t)),mul(sub(p[3],p[2]),3*t*t));
  const dd=add(mul(add(sub(p[2],mul(p[1],2)),p[0]),6*u),mul(add(sub(p[3],mul(p[2],2)),p[1]),6*t));
  return {p:v,d,dd};
};

export function buildTrack({height=32,radius=6.8}={}) {
  const H=height,R=radius,D=3.8;
  const pieces=[];
  function bez(name,points,count=400){pieces.push({name,count,at:t=>cubic(points,t)});}
  function line(name,a,b){bez(name,[a,mix(a,b,1/3),mix(a,b,2/3),b],100);}
  function loop(name,x,r,z){
    pieces.push({name,count:1000,at:t=>{
      const q=t*Math.PI*2, w=Math.PI*2;
      return {p:[x+r*Math.sin(q),BASE+r*(1-Math.cos(q)),z+D*(3*t*t-2*t*t*t)],
              d:[r*w*Math.cos(q),r*w*Math.sin(q),D*(6*t-6*t*t)],
              dd:[-r*w*w*Math.sin(q),r*w*w*Math.cos(q),D*(6-12*t)]};
    }});
  }
  bez('Descenso',[[-60,BASE+H,0],[-46,BASE+H-3,0],[-34,BASE,0],[-14,BASE,0]],650);
  line('Valle',[-14,BASE,0],[0,BASE,0]);
  loop('Vuelta 1',0,R,0);
  bez('Colina',[[0,BASE,D],[6,BASE,D],[8,BASE+R*.36,D],[15,BASE+R*.36,D]],240);
  bez('Colina',[[15,BASE+R*.36,D],[22,BASE+R*.36,D],[24,BASE,D],[30,BASE,D]],240);
  loop('Vuelta 2',30,R*.85,D);
  line('Recta de llegada',[30,BASE,D*2],[46,BASE,D*2]);
  line('Frenado',[46,BASE,D*2],[74,BASE,D*2]);
  const nodes=[],ranges=[];let s=0,previous=null;
  for(const piece of pieces){
    const start=s;
    for(let i=0;i<=piece.count;i++){
      if(nodes.length&&i===0)continue;
      const t=i/piece.count,a=piece.at(t),speed=len(a.d),T=unit(a.d);
      const curvature=mul(sub(a.dd,mul(T,dot(T,a.dd))),1/(speed*speed));
      if(previous)s+=len(sub(a.p,previous));
      nodes.push({s,p:a.p,T,k:curvature,name:piece.name});previous=a.p;
    }
    ranges.push({name:piece.name,start,end:s});
  }
  const l1=ranges.find(r=>r.name==='Vuelta 1'),l2=ranges.find(r=>r.name==='Vuelta 2');
  const landmarks=[
    {id:'A',name:'Salida',s:0},
    {id:'B',name:'Base vuelta 1',s:l1.start},
    {id:'C',name:'Cima vuelta 1',s:(l1.start+l1.end)/2},
    {id:'D',name:'Base vuelta 2',s:l2.start},
    {id:'E',name:'Cima vuelta 2',s:(l2.start+l2.end)/2},
    {id:'F',name:'Salida vuelta 2',s:l2.end},
    {id:'G',name:'Llegada y frenado',s}
  ];
  return {nodes,ranges,length:s,height:H,radius:R,landmarks,brakeStart:ranges.find(r=>r.name==='Frenado').start};
}

export function sampleTrack(track,s){
  if(s<0){const a=track.nodes[0];return {s,p:add(a.p,mul(a.T,s)),T:[...a.T],k:[0,0,0],name:'Embarque'};}
  s=Math.max(0,Math.min(track.length,s));
  let lo=0,hi=track.nodes.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(track.nodes[m].s<s)lo=m;else hi=m;}
  const a=track.nodes[lo],b=track.nodes[hi],f=(s-a.s)/(b.s-a.s||1);
  return {s,p:mix(a.p,b.p,f),T:unit(mix(a.T,b.T,f)),k:mix(a.k,b.k,f),name:f<.5?a.name:b.name};
}

export function forces(track,s,v,mu=0){
  const a=sampleTrack(track,s),gravity=[0,-G,0],gt=dot(gravity,a.T);
  const gp=sub(gravity,mul(a.T,gt));
  const reaction=sub(mul(a.k,v*v),gp),normal=len(reaction);
  const direction=Math.abs(v)>1e-6?Math.sign(v):(Math.abs(gt)>mu*normal?Math.sign(gt):0);
  const friction=mu*normal;
  const at=direction?gt-friction*direction:0;
  return {...a,gt,reaction,normal,friction,at,direction,centripetal:v*v*len(a.k)};
}

export class Simulator {
  constructor(track,{mass=155,mu=0,cars=null}={}){
    this.track=track;this.cars=cars;this.mass=cars?cars.reduce((s,c)=>s+c.mass,0):mass;this.mu=mu;this.s=0;this.v=0;this.q=0;this.t=0;
    this.brakeStart=track.brakeStart+(cars?Math.max(...cars.map(c=>c.offset)):0);
    this.e0=G*(this.forcesAt(0,0).p[1]-BASE);this.stopped=false;
    this.qBrake=0;this.braking=false;this.brakeDecel=0;this.finished=false;
    this.lastDirection=1;this.reversals=0;this.samples=[];this.checkpoints=[];
    this.record();this.checkpoints.push({id:'A',...this.snapshot()});
  }
  forcesAt(s,v){
    if(!this.cars)return forces(this.track,s,v,this.mu);
    const lead=sampleTrack(this.track,s),out={...lead,p:[0,0,0],T:[0,0,0],k:[0,0,0],reaction:[0,0,0],gt:0,normal:0,friction:0,centripetal:0};
    for(const car of this.cars){
      const f=forces(this.track,s-car.offset,v,this.mu),w=car.mass/this.mass;
      for(const key of ['p','T','k','reaction'])for(let i=0;i<3;i++)out[key][i]+=f[key][i]*w;
      for(const key of ['gt','normal','friction','centripetal'])out[key]+=f[key]*w;
    }
    out.motionT=[...out.T];out.T=unit(out.T);out.direction=Math.abs(v)>1e-6?Math.sign(v):(Math.abs(out.gt)>out.friction?Math.sign(out.gt):0);
    out.at=out.direction?out.gt-out.friction*out.direction:0;
    return out;
  }
  snapshot(){
    const f=this.forcesAt(this.s,this.v),h=f.p[1]-BASE;
    const ep=G*h,ec=.5*this.v*this.v,em=ep+ec;
    const resistance=this.stopped?Math.min(f.friction,Math.abs(f.gt)):this.braking?this.brakeDecel:f.friction;
    return {t:this.t,s:this.s,h,v:Math.abs(this.v),signedV:this.v,m:this.mass,
      Ep:ep*this.mass,Ec:ec*this.mass,Em:em*this.mass,Q:this.q*this.mass,
      Qbrake:this.qBrake*this.mass,Qfriction:(this.q-this.qBrake)*this.mass,
      total:(em+this.q)*this.mass,error:(em+this.q-this.e0)*this.mass,
      N:f.normal*this.mass,load:f.normal/G,Ff:(this.stopped?resistance:f.friction)*this.mass,
      Fbrake:this.braking&&!this.stopped?Math.max(0,this.brakeDecel-this.mu*G)*this.mass:0,
      at:this.stopped?0:this.braking?-this.brakeDecel:f.at,ac:f.centripetal,kappa:len(f.k),section:this.finished?'Llegada':f.name,p:f.p,T:f.T,k:f.k,
      reaction:f.reaction,frictionVector:mul(f.T,-resistance*(Math.sign(this.v)||Math.sign(f.gt))),
      mu:this.mu,hLead:sampleTrack(this.track,this.s).p[1]-BASE,velocityVector:mul(f.motionT||f.T,this.v)};
  }
  record(){this.samples.push(this.snapshot());}
  advance(duration){
    let remaining=duration;
    while(remaining>1e-9&&!this.stopped){
      const h=Math.min(.002,remaining),oldS=this.s;
      if(!this.braking&&this.s>=this.brakeStart&&this.v>0){
        this.braking=true;
        // Constant braking on the horizontal arrival straight. Track friction
        // may already suffice to stop before the platform; otherwise the brake
        // supplies the extra force needed to stop at its end.
        this.brakeDecel=Math.max(this.mu*G,this.v*this.v/(2*Math.max(1e-9,this.track.length-this.s)));
      }
      if(this.braking){
        const dt=Math.min(h,this.v/this.brakeDecel),distance=this.v*dt-.5*this.brakeDecel*dt*dt;
        this.s=Math.min(this.track.length,this.s+distance);
        this.q+=this.brakeDecel*distance;
        this.qBrake+=Math.max(0,this.brakeDecel-this.mu*G)*distance;
        this.v=Math.max(0,this.v-this.brakeDecel*dt);this.t+=dt;
        if(this.v<1e-8){
          this.v=0;this.stopped=true;this.finished=true;
          if(this.track.length-this.s<1e-6)this.s=this.track.length;
        }
        this.captureCheckpoints(oldS);
        if(this.stopped||this.t-this.samples.at(-1).t>=.039999)this.record();
        remaining-=dt;continue;
      }
      const f0=this.forcesAt(this.s,this.v);
      if(Math.abs(this.v)<.004&&Math.abs(f0.gt)<=this.mu*f0.normal){
        this.q+=.5*this.v*this.v;this.v=0;this.stopped=true;break;
      }
      const rhs=y=>{
        const f=this.forcesAt(y[0],y[1]);
        return [y[1],f.at,f.friction*Math.abs(y[1])];
      };
      const y=[this.s,this.v,this.q],k1=rhs(y),k2=rhs(add(y,mul(k1,h/2))),
            k3=rhs(add(y,mul(k2,h/2))),k4=rhs(add(y,mul(k3,h)));
      const next=y.map((x,i)=>x+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
      this.s=next[0];this.v=next[1];this.q=Math.max(this.q,next[2]);this.t+=h;
      if(this.s<0){this.s=0;this.v=0;}
      if(this.s>this.track.length)throw new Error('The arrival brake was skipped.');
      const direction=Math.abs(this.v)>.01?Math.sign(this.v):this.lastDirection;
      if(direction!==this.lastDirection){this.reversals++;this.lastDirection=direction;}
      this.captureCheckpoints(oldS);
      if(!this.samples.length||this.t-this.samples[this.samples.length-1].t>=.039999)this.record();
      remaining-=h;
    }
    return this.snapshot();
  }
  captureCheckpoints(oldS){
    if(this.s<=oldS)return;
    for(const point of this.track.landmarks){
      if(point.id!=='A'&&oldS<point.s&&this.s>=point.s&&!this.checkpoints.some(p=>p.id===point.id))
        this.checkpoints.push({id:point.id,...this.snapshot()});
    }
  }
}
