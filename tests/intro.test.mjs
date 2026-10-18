import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const code=await fs.readFile(new URL('../dist/intro.js',import.meta.url),'utf8');
function setup({reject=false}={}){
 const elements=new Map(),events={},calls=[];
 const document={activeElement:null,body:{classList:{remove:x=>calls.push('remove:'+x),add:x=>calls.push('add:'+x)}},getElementById:id=>elements.get(id),addEventListener:(name,cb)=>events[name]=cb};
 for(const id of ['introScreen','labContent','introVideo','introGate','startIntro','introMessage','introProgress','skipIntro','replayIntro','play','simulador'])elements.set(id,{id,hidden:false,style:{},focus(){document.activeElement=this;},setAttribute(k,v){this[k]=v;},scrollIntoView(){calls.push('scroll');},closest(){return null;}});
 const $=id=>elements.get(id),video=$('introVideo');
 Object.assign(video,{paused:true,currentTime:0,duration:66.86667,muted:true,pause(){this.paused=true;this.onpause?.();},play(){calls.push('play');if(reject)return Promise.reject(new Error('blocked'));this.paused=false;this.onplay?.();return Promise.resolve();}});
 $('labContent').inert=true;$('introMessage').hidden=true;
 $('introScreen').querySelectorAll=()=>[$('skipIntro'),video,$('startIntro')];
 const window={dispatchEvent:e=>calls.push(e.type)};
 vm.runInNewContext(code,{document,window,Event:class Event{constructor(type){this.type=type;}}});
 return {$,video,document,events,calls};
}
const a=setup();assert.equal(a.video.paused,true);assert.equal(a.calls.includes('play'),false);assert.equal(a.document.activeElement,a.$('startIntro'));assert.equal(a.video.controls,false);
a.$('startIntro').onclick();await Promise.resolve();assert.equal(a.video.paused,false);assert.equal(a.video.muted,false);assert.equal(a.$('introGate').hidden,true);assert.equal(a.document.activeElement,a.video);assert.equal(a.video.controls,true);
a.video.currentTime=33.433335;a.video.ontimeupdate();assert.equal(a.$('introProgress').style.width,'50%');
a.$('skipIntro').onclick();assert.ok(a.$('introScreen').hidden);assert.equal(a.$('labContent').inert,false);assert.equal(a.video.paused,true);assert.equal(a.document.activeElement,a.$('play'));
a.$('replayIntro').onclick();await Promise.resolve();assert.equal(a.video.currentTime,0);assert.equal(a.video.muted,false);assert.equal(a.$('labContent').inert,true);assert.ok(a.calls.includes('introopened'));a.video.onended();assert.ok(a.$('introScreen').hidden);
const b=setup({reject:true});b.$('startIntro').onclick();await Promise.resolve();await Promise.resolve();assert.equal(b.$('introMessage').hidden,false);assert.equal(b.$('introGate').hidden,false);b.$('skipIntro').onclick();assert.ok(b.$('introScreen').hidden);
const c=setup();c.events.keydown({key:'Escape',preventDefault(){}});assert.ok(c.$('introScreen').hidden);
console.log('Intro: one entry button, audible gesture start, native playback controls, focus, skip, replay, completion and error fallback passed.');
