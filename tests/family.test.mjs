import assert from 'node:assert/strict';import {buildTrack,Simulator,sampleTrack,BASE,G} from '../dist/physics.js';
const cars=[100,65,35,30,10].map((m,i)=>({mass:55+m,offset:i*4.6}));
for(const height of [14,32,50])for(const radius of [4,6.8,9])for(const mu of [0,.012,.08]){
 const track=buildTrack({height,radius}),sim=new Simulator(track,{mu,cars});let max=0;
 assert.equal(sim.mass,515);assert.ok(sim.brakeStart>track.brakeStart);
 for(let i=0;i<1500&&!sim.stopped;i++){
  const s=sim.advance(.04);const expected=cars.reduce((sum,c)=>sum+c.mass*G*(sampleTrack(track,sim.s-c.offset).p[1]-BASE),0);
  assert.ok(Math.abs(expected-s.Ep)<1e-6);assert.ok(Math.abs(s.Ec-cars.reduce((sum,c)=>sum+.5*c.mass*sim.v*sim.v,0))<1e-6);
  assert.ok(Number.isFinite(s.total));max=Math.max(max,Math.abs(s.error)/(sim.e0*sim.mass));
  if(sim.braking)assert.ok(cars.every(c=>sim.s-c.offset>=track.brakeStart-1e-8));
 }
 assert.ok(max<.0001,`Family balance drift ${max}, H ${height}, R ${radius}, mu ${mu}`);
}
const track=buildTrack(),a=new Simulator(track,{cars,mu:.012}),b=new Simulator(track,{cars:cars.map(c=>({...c,mass:c.mass*2})),mu:.012});
for(let i=0;i<800;i++){const x=a.advance(.025),y=b.advance(.025);assert.ok(Math.abs(x.s-y.s)<1e-8);assert.ok(Math.abs(x.v-y.v)<1e-8);assert.ok(Math.abs(y.Ep-2*x.Ep)<1e-5);}
assert.ok(a.finished);assert.equal(a.snapshot().h,0);assert.equal(a.snapshot().v,0);assert.equal(a.checkpoints.length,7);
console.log('Family: 27 parameter combinations, exact sum of car energies, proportional mass scaling, whole-train braking and stopped arrival passed.');
