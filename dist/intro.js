(() => {
 const $=id=>document.getElementById(id),video=$('introVideo'),screen=$('introScreen'),content=$('labContent'),gate=$('introGate');
 let previousFocus=null;
 function start(){
  video.muted=false;video.volume=.85;video.controls=true;
  video.play().catch(()=>{gate.hidden=false;$('introMessage').hidden=false;$('introMessage').textContent='No se pudo iniciar. Pulsa Reproducir o elige Omitir intro.';});
 }
 function close(){video.pause();screen.hidden=true;content.inert=false;document.body.classList.remove('intro-open');window.dispatchEvent(new Event('introclosed'));(previousFocus||$('play')).focus({preventScroll:true});if(!previousFocus)$('simulador').scrollIntoView({behavior:'instant'});}
 function open(){previousFocus=document.activeElement;window.dispatchEvent(new Event('introopened'));screen.hidden=false;content.inert=true;document.body.classList.add('intro-open');video.currentTime=0;$('introMessage').hidden=true;$('skipIntro').focus();start();}
 $('startIntro').onclick=start;$('skipIntro').onclick=close;$('replayIntro').onclick=open;
 video.onplay=()=>{if(!gate.hidden){gate.hidden=true;video.focus();}};video.onended=close;
 video.ontimeupdate=()=>{const duration=Number.isFinite(video.duration)?video.duration:67;$('introProgress').style.width=Math.min(100,video.currentTime/duration*100)+'%';};
 video.onerror=()=>{$('introMessage').textContent='No se pudo reproducir el video. Puedes entrar con Omitir intro.';$('introMessage').hidden=false;gate.hidden=false;};
 document.addEventListener('keydown',e=>{
  if(screen.hidden)return;
  if(e.key==='Escape'){e.preventDefault();close();}
  if(e.key==='Tab'){const items=[...screen.querySelectorAll('button,video')].filter(b=>!b.closest('[hidden]')&&(b!==video||gate.hidden));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 });
 video.muted=false;video.controls=false;video.pause();gate.hidden=false;$('startIntro').focus();
})();
