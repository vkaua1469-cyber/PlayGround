(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const ui = {
    score: document.querySelector('#score'), best: document.querySelector('#best'), level: document.querySelector('#level'),
    lives: document.querySelector('#lives'), welcome: document.querySelector('#welcome'), pause: document.querySelector('#pauseOverlay'),
    over: document.querySelector('#gameOver'), final: document.querySelector('#finalScore'), record: document.querySelector('#recordMessage'),
    start: document.querySelector('#startBtn'), restart: document.querySelector('#restartBtn'), resume: document.querySelector('#resumeBtn'),
    pauseBtn: document.querySelector('#pauseBtn'), soundBtn: document.querySelector('#soundBtn')
  };
  const bestKey = 'lume-best-v1';
  let best = Number(localStorage.getItem(bestKey) || 0);
  let width = 0, height = 0, dpr = 1, last = 0, elapsed = 0, spawnClock = 0;
  let score = 0, lives = 3, running = false, paused = false, gameEnded = false, soundOn = false;
  let objects = [], particles = [], stars = [], player = { x: 0, y: 0, targetX: 0, radius: 13, invulnerable: 0, shield: 0 };
  let audio;
  ui.best.textContent = pad(best);

  function pad(n) { return String(n).padStart(4, '0'); }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.y = height * .82;
    if (!player.x) player.x = player.targetX = width * .5;
    player.x = Math.min(width - 22, Math.max(22, player.x)); player.targetX = Math.min(width - 22, Math.max(22, player.targetX));
    if (!stars.length) stars = Array.from({length: 68}, () => ({x:Math.random()*width,y:Math.random()*height,size:.4+Math.random()*1.25,alpha:.15+Math.random()*.55,phase:Math.random()*6.2,speed:5+Math.random()*15}));
  }
  window.addEventListener('resize', resize); resize();

  function sound(freq=620, duration=.09, type='sine') {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.65), audio.currentTime+duration);
      gain.gain.setValueAtTime(.055,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime+duration);
    } catch (_) { /* Áudio é opcional. */ }
  }
  function updateHud() {
    ui.score.textContent = pad(score); ui.best.textContent = pad(best); ui.level.textContent = String(1 + Math.floor(score / 100)).padStart(2, '0');
    ui.lives.innerHTML = Array.from({length:3}, (_,i) => `<span class="${i >= lives ? 'lost' : ''}">♥</span>`).join(' ');
    ui.lives.setAttribute('aria-label', `${lives} ${lives === 1 ? 'vida' : 'vidas'}`);
  }
  function startGame() {
    score=0; lives=3; elapsed=0; spawnClock=.35; objects=[]; particles=[];
    player.x=player.targetX=width*.5; player.y=height*.82; player.invulnerable=0; player.shield=0;
    running=true; paused=false; gameEnded=false;
    ui.welcome.classList.add('is-hidden'); ui.pause.hidden=true; ui.over.hidden=true; ui.pauseBtn.disabled=false;
    updateHud(); last=performance.now(); sound(500,.13);
  }
  function pauseGame() { if (!running || gameEnded) return; paused=true; ui.pause.hidden=false; ui.pauseBtn.disabled=true; }
  function resumeGame() { if (!running || gameEnded) return; paused=false; ui.pause.hidden=true; ui.pauseBtn.disabled=false; last=performance.now(); }
  function endGame() {
    running=false; gameEnded=true; ui.pauseBtn.disabled=true;
    const isRecord=score>best;
    if(isRecord){best=score;localStorage.setItem(bestKey,String(best));}
    ui.final.textContent=score; ui.record.textContent=isRecord && score>0 ? '✦ NOVO RECORDE PESSOAL ✦' : `RECORDE PESSOAL  ${pad(best)}`;
    updateHud(); ui.over.hidden=false; sound(180,.28,'triangle');
  }
  function pointerX(e) { const r=canvas.getBoundingClientRect(); player.targetX=Math.max(22,Math.min(width-22,e.clientX-r.left)); }
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture?.(e.pointerId); pointerX(e); });
  canvas.addEventListener('pointermove', e => { if(e.buttons || e.pointerType==='touch') pointerX(e); });
  window.addEventListener('keydown', e => {
    if(['ArrowLeft','ArrowRight',' ','a','A','d','D'].includes(e.key)) e.preventDefault();
    if(e.key==='Escape'||e.key==='p'||e.key==='P'){paused?resumeGame():pauseGame();return;}
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') player.targetX=Math.max(22,player.targetX-34);
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') player.targetX=Math.min(width-22,player.targetX+34);
    if(e.key===' ' && !running && !gameEnded) startGame();
  });
  ui.start.addEventListener('click', startGame); ui.restart.addEventListener('click', startGame);
  ui.pauseBtn.addEventListener('click', pauseGame); ui.resume.addEventListener('click', resumeGame);
  ui.soundBtn.addEventListener('click', () => {soundOn=!soundOn; ui.soundBtn.textContent=soundOn?'♫':'♩'; ui.soundBtn.setAttribute('aria-label',soundOn?'Desativar som':'Ativar som'); if(soundOn)sound(600,.08);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)pauseGame();});
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  function spawn() {
    const dangerChance=Math.min(.76,.54+elapsed*.002);
    const isStar=Math.random()>dangerChance;
    const radius=isStar?9+Math.random()*2:12+Math.random()*9;
    objects.push({x:22+Math.random()*(width-44), y:-28, radius, type:isStar?'star':'meteor', speed:(isStar?125:130)+Math.random()*55+Math.min(elapsed*1.4,115), drift:(Math.random()-.5)*(isStar?18:44), rotation:Math.random()*6.28, spin:(Math.random()-.5)*2});
    if(elapsed>20 && Math.random()<.035) objects.push({x:22+Math.random()*(width-44),y:-50,radius:10,type:'moon',speed:103,drift:0,rotation:0,spin:0});
  }
  function burst(x,y,color,count=9) { for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*105;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.35,max:.7,size:1.2+Math.random()*2.2,color});} }
  function collide(o) {
    const dx=o.x-player.x, dy=o.y-player.y, rr=o.radius+player.radius*.72;
    return dx*dx+dy*dy<rr*rr;
  }
  function step(dt) {
    elapsed+=dt; spawnClock-=dt;
    const interval=Math.max(.31,.77-elapsed*.004);
    if(spawnClock<=0){spawn();spawnClock=interval*(.72+Math.random()*.55);}
    player.x+=(player.targetX-player.x)*Math.min(1,dt*13);
    player.invulnerable=Math.max(0,player.invulnerable-dt); player.shield=Math.max(0,player.shield-dt);
    for(const s of stars){s.y+=s.speed*dt;if(s.y>height+4){s.y=-4;s.x=Math.random()*width;}}
    for(let i=objects.length-1;i>=0;i--){const o=objects[i];o.y+=o.speed*dt;o.x+=o.drift*dt;o.rotation+=o.spin*dt;
      if(o.x<12||o.x>width-12)o.drift*=-1;
      if(collide(o)){
        objects.splice(i,1);
        if(o.type==='star'){score+=10;burst(o.x,o.y,'#ffe9a7',7);sound(820,.07);}
        else if(o.type==='moon'){player.shield=7;score+=5;burst(o.x,o.y,'#b7a3ff',11);sound(520,.15);}
        else if(player.shield>0){burst(o.x,o.y,'#b7a3ff',10);sound(300,.09,'triangle');}
        else if(player.invulnerable<=0){lives--;player.invulnerable=1.35;burst(player.x,player.y,'#ff80ad',15);sound(170,.18,'sawtooth');if(lives<=0){updateHud();endGame();return;}}
        updateHud(); continue;
      }
      if(o.y>height+35)objects.splice(i,1);
    }
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.98;p.vy*=.98;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
  }
  function roundedGlow(x,y,r,color,blur){ctx.save();ctx.shadowBlur=blur;ctx.shadowColor=color;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawStar(x,y,r,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.42:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.restore();}
  function render(now) {
    ctx.clearRect(0,0,width,height);
    for(const s of stars){const twinkle=.7+.3*Math.sin(now*.001+s.phase);ctx.fillStyle=`rgba(218,211,255,${s.alpha*twinkle})`;ctx.beginPath();ctx.arc(s.x,s.y,s.size,0,Math.PI*2);ctx.fill();}
    // Horizonte de luz e constelações discretas.
    const glow=ctx.createRadialGradient(width*.5,height*.83,4,width*.5,height*.83,width*.68);glow.addColorStop(0,'rgba(151,112,255,.15)');glow.addColorStop(1,'rgba(151,112,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,height*.4,width,height*.6);
    for(const o of objects){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rotation);
      if(o.type==='star'){
        ctx.shadowBlur=17;ctx.shadowColor='#ffe5a0';ctx.fillStyle='#ffeab4';drawStar(0,0,o.radius,0);
        ctx.shadowBlur=0;ctx.fillStyle='#fff9df';ctx.beginPath();ctx.arc(-2,-2,2,0,7);ctx.fill();
      } else if(o.type==='moon'){
        ctx.shadowBlur=20;ctx.shadowColor='#b59bff';ctx.fillStyle='#c8b3ff';ctx.beginPath();ctx.arc(0,0,o.radius,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#6f5caa';ctx.beginPath();ctx.arc(4,-3,o.radius*.88,0,7);ctx.fill();
      } else {
        ctx.shadowBlur=12;ctx.shadowColor='#ff6c91';ctx.fillStyle='#d87586';ctx.beginPath();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,r=o.radius*(i%2?.83:1)*(i%3===0?1.06:1);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#f8a18e';ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(-o.radius*.22,-o.radius*.18,o.radius*.24,0,7);ctx.fill();
      }ctx.restore();}
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,7);ctx.fill();}ctx.globalAlpha=1;
    // Pequena guardiã luminosa.
    const blink=player.invulnerable>0 && Math.floor(now/90)%2===0;
    if(!blink){ctx.save();ctx.translate(player.x,player.y);if(player.shield>0){ctx.strokeStyle=`rgba(195,173,255,${.55+.18*Math.sin(now*.009)})`;ctx.lineWidth=2;ctx.shadowBlur=17;ctx.shadowColor='#bba1ff';ctx.beginPath();ctx.arc(0,0,player.radius+10,0,7);ctx.stroke();}
      const aura=ctx.createRadialGradient(0,0,2,0,0,player.radius*2.7);aura.addColorStop(0,'rgba(255,235,184,.66)');aura.addColorStop(.4,'rgba(198,166,255,.36)');aura.addColorStop(1,'rgba(155,122,255,0)');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,player.radius*2.7,0,7);ctx.fill();
      ctx.shadowBlur=23;ctx.shadowColor='#c7a6ff';const orb=ctx.createRadialGradient(-4,-5,1,1,1,player.radius+2);orb.addColorStop(0,'#fff8d8');orb.addColorStop(.33,'#f5d6b1');orb.addColorStop(.72,'#c6a0fa');orb.addColorStop(1,'#8866cb');ctx.fillStyle=orb;ctx.beginPath();ctx.arc(0,0,player.radius,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff7d1';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('✦',0,3);ctx.restore();}
  }
  function frame(now) { const dt=Math.min(.04,(now-last)/1000||0);last=now;if(running&&!paused&&!gameEnded)step(dt);render(now);requestAnimationFrame(frame); }
  requestAnimationFrame(now=>{last=now;frame(now);});
})();
