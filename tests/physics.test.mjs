import assert from 'node:assert/strict';
import {buildTrack,Simulator,G,BASE} from '../dist/physics.js';

for(const height of [14,32,50])for(const radius of [4,6.8,9])for(const mu of [0,.012,.08]){
 const track=buildTrack({height,radius});
 const sim=new Simulator(track,{mass:155,mu});
 assert.ok(track.nodes.every(n=>n.p.every(Number.isFinite)&&n.T.every(Number.isFinite)&&n.k.every(Number.isFinite)));
 assert.ok(Math.abs(track.nodes[0].p[1]-BASE-height)<1e-10);
 assert.equal(track.nodes.at(-1).p[1],BASE,'The arrival must stay at ground level');
 let heat=0,maxError=0;
 for(let i=0;i<1200&&!sim.stopped;i++){
  const s=sim.advance(.025);
  assert.ok(Number.isFinite(s.Em)&&s.h>=-1e-7&&s.v>=0);
  assert.ok(s.Q>=heat-1e-8);heat=s.Q;
  maxError=Math.max(maxError,Math.abs(s.error)/(sim.e0*sim.mass));
  if(mu===0&&!sim.braking)assert.equal(s.Q,0);
  assert.ok(Math.abs(s.Q-s.Qbrake-s.Qfriction)<1e-7);
 }
 assert.ok(maxError<.0001,`Energy drift ${maxError} for height=${height},radius=${radius},mu=${mu}`);
}
const track=buildTrack();const a=new Simulator(track,{mass:65,mu:.018}),b=new Simulator(track,{mass:215,mu:.018});
for(let i=0;i<2000;i++){
 const x=a.advance(.03),y=b.advance(.03);
 assert.equal(x.s,y.s);assert.equal(x.v,y.v);
 assert.ok(Math.abs(x.Ep/65-y.Ep/215)<1e-7);
 assert.ok(Math.abs(x.Ec/65-y.Ec/215)<1e-7);
}
const ideal=new Simulator(track,{mass:155,mu:0});
for(let i=0;i<1000;i++)ideal.advance(.025);
assert.equal(ideal.checkpoints.length,7);
assert.ok(Math.abs(ideal.checkpoints.find(x=>x.id==='B').v-Math.sqrt(2*G*track.height))<.02);
assert.ok(ideal.finished&&ideal.stopped);
assert.equal(ideal.snapshot().h,0);assert.equal(ideal.snapshot().v,0);
assert.equal(ideal.s,track.length);assert.equal(ideal.snapshot().Qfriction,0);
assert.ok(Math.abs(ideal.snapshot().Qbrake-ideal.e0*ideal.mass)/(ideal.e0*ideal.mass)<.0001);
assert.equal(ideal.samples.at(-1).v,0,'The final sample records the stopped arrival');
console.log('27 parameter combinations passed; drift below 0.01%; mass independence, valley speed, ground-level arrival and brake heat passed.');
