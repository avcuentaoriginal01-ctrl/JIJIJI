// ================================================================
//  main.js — optimizado para móvil y desktop
// ================================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', {alpha: false});

// ---- Detección móvil ----
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

let W, H, dpr, bgGrad = null;
let resizeTimer = null;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bgGrad = null;
}
resize();
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 150);
});

const rand  = (a, b) => Math.random() * (b - a) + a;
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let t0 = null, elapsed = 0;

// ---- Audio + splash ----
const bgAudio = document.getElementById('bg');
bgAudio.volume = 0.25;
const splash  = document.getElementById('splash');
const startBtn = document.getElementById('startBtn');
let animStarted = false;

startBtn.addEventListener('click', startExperience);

function startExperience() {
  if (animStarted) return;
  animStarted = true;
  bgAudio.play().catch(() => {});
  splash.classList.add('hidden');
  setTimeout(() => { splash.style.display = 'none'; }, 1100);
  t0 = null;
  requestAnimationFrame(frame);
}

// ================================================================
//  ESTRELLAS — menos en móvil
// ================================================================
const STAR_COUNT = isMobile ? 80 : 160;
const stars = Array.from({length: STAR_COUNT}, () => ({
  x: rand(0,1), y: rand(0,0.85), r: rand(0.5, isMobile ? 1.8 : 2.2),
  phase: rand(0,Math.PI*2), speed: rand(0.8,2.5)
}));
function drawStars() {
  for (const s of stars) {
    const a = 0.3 + 0.7*(0.5 + 0.5*Math.sin(elapsed*s.speed + s.phase));
    ctx.beginPath();
    ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,220,${a.toFixed(2)})`;
    ctx.fill();
  }
}

// ================================================================
//  FONDO — gradiente cacheado
// ================================================================
function drawBackground() {
  if (!bgGrad) {
    bgGrad = ctx.createRadialGradient(W/2,H*0.3,0, W/2,H*0.3,H*0.9);
    bgGrad.addColorStop(0,'#0d2010');
    bgGrad.addColorStop(0.5,'#071208');
    bgGrad.addColorStop(1,'#020602');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
}

// ================================================================
//  PASTO — menos hojas en móvil
// ================================================================
const GRASS_COUNT = isMobile ? 70 : 130;
const grassBlades = Array.from({length: GRASS_COUNT}, () => ({
  x: rand(0,1), h: rand(0.06,0.18), w: rand(3,11),
  angle: rand(-22,22), phase: rand(0,Math.PI*2), speed: rand(0.6,1.4),
  color: `hsl(${rand(110,135)},${rand(55,75)}%,${rand(14,26)}%)`
}));
function drawGrass() {
  for (const g of grassBlades) {
    const sway = Math.sin(elapsed*g.speed + g.phase) * 4;
    const bx = g.x*W, by = H;
    const rad = (g.angle + sway) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(bx - g.w/2, by);
    ctx.quadraticCurveTo(
      bx + Math.sin(rad)*g.h*H*0.5, by - g.h*H*0.5,
      bx + Math.sin(rad)*g.h*H,     by - g.h*H
    );
    ctx.lineWidth = g.w; ctx.lineCap = 'round';
    ctx.strokeStyle = g.color; ctx.stroke();
  }
}

// ================================================================
//  RAMO — escala adaptada a portrait/landscape móvil
// ================================================================
const BX = () => W / 2;
const BY = () => H * 0.84;
const SC = () => {
  // En portrait móvil usar el ancho, en landscape el alto
  const ref = W < H ? W : H;
  return clamp(ref * (isMobile ? 0.0018 : 0.0015), 0.5, 1.8);
};

const FLOWER_DEFS = [
  {ox:-0.9, oy:-5.2, size:1.10, delay:0.3,  type:'sun'},
  {ox: 0.0, oy:-5.8, size:1.20, delay:0.7,  type:'sun'},
  {ox: 0.9, oy:-5.2, size:1.10, delay:1.1,  type:'sun'},
  {ox:-1.6, oy:-3.8, size:1.05, delay:1.5,  type:'sun'},
  {ox:-0.7, oy:-4.2, size:0.90, delay:1.8,  type:'rose'},
  {ox: 0.0, oy:-3.6, size:1.08, delay:2.1,  type:'sun'},
  {ox: 0.7, oy:-4.2, size:0.90, delay:2.4,  type:'rose'},
  {ox: 1.6, oy:-3.8, size:1.05, delay:2.7,  type:'sun'},
  {ox:-0.8, oy:-2.4, size:1.00, delay:3.0,  type:'sun'},
  {ox: 0.0, oy:-2.6, size:0.92, delay:3.3,  type:'rose'},
  {ox: 0.8, oy:-2.4, size:1.00, delay:3.6,  type:'sun'},
];
const flowerState = FLOWER_DEFS.map(() => ({scale:0, stemT:0}));

// ================================================================
//  TALLO
// ================================================================
function drawStem(x1,y1,x2,y2,progress,width,color) {
  if (progress <= 0) return;
  const cpx = x1+(x2-x1)*0.15, cpy = y1-(y1-y2)*0.4;
  ctx.beginPath(); ctx.moveTo(x1,y1);
  const steps = isMobile ? 20 : 30;
  for (let i=1; i<=steps; i++) {
    const t=(i/steps)*progress, mt=1-t;
    ctx.lineTo(mt*mt*x1+2*mt*t*cpx+t*t*x2, mt*mt*y1+2*mt*t*cpy+t*t*y2);
  }
  ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round';
  ctx.shadowColor='rgba(0,80,0,0.4)'; ctx.shadowBlur=4; ctx.stroke();
  ctx.shadowBlur=0;
}

// ================================================================
//  HOJA
// ================================================================
function drawLeaf(cx,cy,angle,size,flip) {
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle);
  if (flip) ctx.scale(1,-1);
  const g = ctx.createLinearGradient(0,0,size,0);
  g.addColorStop(0,'#1a6b1a'); g.addColorStop(0.4,'#2da82d'); g.addColorStop(1,'#0d4a0d');
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.bezierCurveTo(size*0.3,-size*0.28, size*0.8,-size*0.22, size,0);
  ctx.bezierCurveTo(size*0.8,size*0.22, size*0.3,size*0.28, 0,0);
  ctx.fillStyle=g; ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=4; ctx.fill();
  ctx.shadowBlur=0;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(size*0.88,0);
  ctx.strokeStyle='rgba(0,80,0,0.5)'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

// ================================================================
//  GIRASOL — semillas reducidas en móvil
// ================================================================
function drawSunflower(cx,cy,r,sway) {
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(sway);
  const PETALS = 16;
  ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=14;
  for (let i=0; i<PETALS; i++) {
    ctx.save(); ctx.rotate((i/PETALS)*Math.PI*2);
    const g=ctx.createLinearGradient(r*0.35,0,r*1.05,0);
    g.addColorStop(0,'#e6a800'); g.addColorStop(0.5,'#ffd000'); g.addColorStop(1,'#ffe566');
    ctx.beginPath(); ctx.ellipse(r*0.72,0,r*0.38,r*0.14,0,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill(); ctx.restore();
  }
  for (let i=0; i<PETALS; i++) {
    ctx.save(); ctx.rotate((i/PETALS)*Math.PI*2 + Math.PI/PETALS);
    const g=ctx.createLinearGradient(r*0.3,0,r*1.0,0);
    g.addColorStop(0,'#cc9200'); g.addColorStop(0.4,'#ffcc00'); g.addColorStop(1,'#fff0a0');
    ctx.beginPath(); ctx.ellipse(r*0.68,0,r*0.36,r*0.13,0,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill(); ctx.restore();
  }
  ctx.shadowBlur=0;
  const dg=ctx.createRadialGradient(-r*0.08,-r*0.08,r*0.02,0,0,r*0.42);
  dg.addColorStop(0,'#6b3800'); dg.addColorStop(0.4,'#3d1f00'); dg.addColorStop(1,'#1a0a00');
  ctx.beginPath(); ctx.arc(0,0,r*0.42,0,Math.PI*2);
  ctx.fillStyle=dg; ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=8; ctx.fill();
  ctx.shadowBlur=0;
  const seeds = isMobile ? 18 : 28;
  for (let si=0; si<seeds; si++) {
    const sa=(si/seeds)*Math.PI*2, sr=r*0.12+(si%5)*r*0.055;
    ctx.beginPath();
    ctx.arc(Math.cos(sa+si*0.4)*sr, Math.sin(sa+si*0.4)*sr, r*0.028,0,Math.PI*2);
    ctx.fillStyle=`rgba(${80+si*3},40,0,0.7)`; ctx.fill();
  }
  const sg=ctx.createRadialGradient(-r*0.12,-r*0.12,0,-r*0.08,-r*0.08,r*0.22);
  sg.addColorStop(0,'rgba(255,180,80,0.3)'); sg.addColorStop(1,'rgba(255,180,80,0)');
  ctx.beginPath(); ctx.arc(0,0,r*0.42,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
  ctx.restore();
}

// ================================================================
//  ROSA
// ================================================================
function drawRose(cx,cy,r,sway) {
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(sway);
  ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur= isMobile ? 8 : 14;
  for (let i=0;i<5;i++) {
    ctx.save(); ctx.rotate((i/5)*Math.PI*2);
    ctx.beginPath(); ctx.ellipse(r*0.58,0,r*0.35,r*0.11,0,0,Math.PI*2);
    ctx.fillStyle='#1a5c1a'; ctx.fill(); ctx.restore();
  }
  for (let i=0;i<5;i++) {
    ctx.save(); ctx.rotate((i/5)*Math.PI*2);
    const g=ctx.createLinearGradient(0,0,r,0);
    g.addColorStop(0,'#8b0a2a'); g.addColorStop(0.5,'#c01840'); g.addColorStop(1,'#7a0820');
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.bezierCurveTo(r*0.18,-r*0.80, r*0.88,-r*0.65, r*0.95,0);
    ctx.bezierCurveTo(r*0.88,r*0.65, r*0.18,r*0.80, 0,0);
    ctx.fillStyle=g; ctx.fill(); ctx.restore();
  }
  for (let i=0;i<5;i++) {
    ctx.save(); ctx.rotate((i/5)*Math.PI*2 + Math.PI/5);
    const g=ctx.createLinearGradient(0,0,r*0.72,0);
    g.addColorStop(0,'#a01030'); g.addColorStop(0.5,'#d02050'); g.addColorStop(1,'#8a0a22');
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.bezierCurveTo(r*0.12,-r*0.60, r*0.68,-r*0.50, r*0.72,0);
    ctx.bezierCurveTo(r*0.68,r*0.50, r*0.12,r*0.60, 0,0);
    ctx.fillStyle=g; ctx.fill(); ctx.restore();
  }
  for (let i=0;i<4;i++) {
    ctx.save(); ctx.rotate((i/4)*Math.PI*2 + i*0.25);
    const g=ctx.createLinearGradient(0,0,r*0.44,0);
    g.addColorStop(0,'#c01840'); g.addColorStop(1,'#7a0820');
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.bezierCurveTo(r*0.06,-r*0.35, r*0.38,-r*0.28, r*0.42,0);
    ctx.bezierCurveTo(r*0.38,r*0.28, r*0.06,r*0.35, 0,0);
    ctx.fillStyle=g; ctx.fill(); ctx.restore();
  }
  ctx.shadowBlur=0;
  const cg=ctx.createRadialGradient(0,0,0,0,0,r*0.20);
  cg.addColorStop(0,'#d02848'); cg.addColorStop(1,'#6a0818');
  ctx.beginPath(); ctx.arc(0,0,r*0.20,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  ctx.beginPath(); ctx.arc(-r*0.06,-r*0.07,r*0.07,0,Math.PI*2);
  ctx.fillStyle='rgba(255,160,160,0.15)'; ctx.fill();
  ctx.restore();
}

// ================================================================
//  ENVOLTORIO FONDO
// ================================================================
function drawWrapperBack(bx,by,sc) {
  const unit=sc*80;
  const yTop  = by + (-5.8)*unit*0.9 - unit*0.4;
  const yKnot = by - unit*0.18;
  const yBot  = by + unit*0.12;
  const wTop  = unit*2.20;
  const wKnot = unit*0.22;

  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.65)'; ctx.shadowBlur=24;

  // Capa trasera
  const bg=ctx.createLinearGradient(bx-wTop,0,bx+wTop,0);
  bg.addColorStop(0,'#4a0820'); bg.addColorStop(0.2,'#7a1438');
  bg.addColorStop(0.5,'#921848'); bg.addColorStop(0.8,'#7a1438'); bg.addColorStop(1,'#4a0820');
  ctx.beginPath();
  ctx.moveTo(bx-wKnot,yBot);
  ctx.lineTo(bx-wTop*0.80,yTop+unit*0.28);
  ctx.bezierCurveTo(bx-wTop*0.90,yTop+unit*0.02,bx-wTop*0.82,yTop-unit*0.28,bx-wTop*0.52,yTop-unit*0.08);
  ctx.bezierCurveTo(bx-wTop*0.28,yTop+unit*0.04,bx-wTop*0.08,yTop+unit*0.10,bx,yTop+unit*0.06);
  ctx.bezierCurveTo(bx+wTop*0.08,yTop+unit*0.10,bx+wTop*0.28,yTop+unit*0.04,bx+wTop*0.52,yTop-unit*0.08);
  ctx.bezierCurveTo(bx+wTop*0.82,yTop-unit*0.28,bx+wTop*0.90,yTop+unit*0.02,bx+wTop*0.80,yTop+unit*0.28);
  ctx.lineTo(bx+wKnot,yBot);
  ctx.closePath();
  ctx.fillStyle=bg; ctx.fill();
  ctx.shadowBlur=0;

  // Capa frontal izquierda
  const lg=ctx.createLinearGradient(bx-wTop,0,bx,0);
  lg.addColorStop(0,'#5e0e28'); lg.addColorStop(0.5,'#b02858'); lg.addColorStop(1,'#7a1438');
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=12;
  ctx.beginPath();
  ctx.moveTo(bx-wKnot*0.55,yBot);
  ctx.lineTo(bx-wTop*0.72,yTop+unit*0.25);
  ctx.bezierCurveTo(bx-wTop*0.86,yTop,bx-wTop*0.76,yTop-unit*0.32,bx-wTop*0.44,yTop-unit*0.06);
  ctx.bezierCurveTo(bx-wTop*0.20,yTop+unit*0.06,bx-wTop*0.04,yTop+unit*0.14,bx+unit*0.06,yTop+unit*0.10);
  ctx.lineTo(bx+unit*0.04,yKnot);
  ctx.closePath();
  ctx.fillStyle=lg; ctx.fill();

  // Sombra interna izq
  const sl=ctx.createLinearGradient(bx-wTop*0.72,0,bx-wTop*0.30,0);
  sl.addColorStop(0,'rgba(0,0,0,0.35)'); sl.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(bx-wKnot*0.55,yBot);
  ctx.lineTo(bx-wTop*0.72,yTop+unit*0.25);
  ctx.bezierCurveTo(bx-wTop*0.86,yTop,bx-wTop*0.76,yTop-unit*0.32,bx-wTop*0.44,yTop-unit*0.06);
  ctx.bezierCurveTo(bx-wTop*0.20,yTop+unit*0.06,bx-wTop*0.04,yTop+unit*0.14,bx+unit*0.06,yTop+unit*0.10);
  ctx.lineTo(bx+unit*0.04,yKnot);
  ctx.closePath();
  ctx.fillStyle=sl; ctx.fill();
  ctx.shadowBlur=0;

  // Capa frontal derecha
  const rg=ctx.createLinearGradient(bx,0,bx+wTop,0);
  rg.addColorStop(0,'#7a1438'); rg.addColorStop(0.5,'#b02858'); rg.addColorStop(1,'#5e0e28');
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=12;
  ctx.beginPath();
  ctx.moveTo(bx+wKnot*0.55,yBot);
  ctx.lineTo(bx+wTop*0.72,yTop+unit*0.25);
  ctx.bezierCurveTo(bx+wTop*0.86,yTop,bx+wTop*0.76,yTop-unit*0.32,bx+wTop*0.44,yTop-unit*0.06);
  ctx.bezierCurveTo(bx+wTop*0.20,yTop+unit*0.06,bx+wTop*0.04,yTop+unit*0.14,bx-unit*0.06,yTop+unit*0.10);
  ctx.lineTo(bx-unit*0.04,yKnot);
  ctx.closePath();
  ctx.fillStyle=rg; ctx.fill();

  // Sombra interna der
  const sr=ctx.createLinearGradient(bx+wTop*0.30,0,bx+wTop*0.72,0);
  sr.addColorStop(0,'rgba(0,0,0,0)'); sr.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.beginPath();
  ctx.moveTo(bx+wKnot*0.55,yBot);
  ctx.lineTo(bx+wTop*0.72,yTop+unit*0.25);
  ctx.bezierCurveTo(bx+wTop*0.86,yTop,bx+wTop*0.76,yTop-unit*0.32,bx+wTop*0.44,yTop-unit*0.06);
  ctx.bezierCurveTo(bx+wTop*0.20,yTop+unit*0.06,bx+wTop*0.04,yTop+unit*0.14,bx-unit*0.06,yTop+unit*0.10);
  ctx.lineTo(bx-unit*0.04,yKnot);
  ctx.closePath();
  ctx.fillStyle=sr; ctx.fill();
  ctx.shadowBlur=0;

  // Brillo satinado
  const shine=ctx.createLinearGradient(bx-wTop*0.55,yTop,bx-wTop*0.15,yKnot);
  shine.addColorStop(0,'rgba(255,180,200,0.18)');
  shine.addColorStop(0.5,'rgba(255,180,200,0.07)');
  shine.addColorStop(1,'rgba(255,180,200,0)');
  ctx.beginPath();
  ctx.moveTo(bx-wTop*0.55,yTop+unit*0.12);
  ctx.lineTo(bx-wTop*0.30,yTop+unit*0.08);
  ctx.lineTo(bx-wKnot*0.45,yKnot);
  ctx.lineTo(bx-wTop*0.50,yKnot);
  ctx.closePath();
  ctx.fillStyle=shine; ctx.fill();
  ctx.restore();
}

// ================================================================
//  ENVOLTORIO FRENTE
// ================================================================
function drawWrapperFront(bx,by,sc) {
  const unit=sc*80;
  const yKnot=by-unit*0.18, yBot=by+unit*0.12;
  const wKnot=unit*0.22, ribbonH=unit*0.10;

  ctx.save();

  // Tallos agrupados
  const sg=ctx.createLinearGradient(bx-wKnot*0.5,0,bx+wKnot*0.5,0);
  sg.addColorStop(0,'#0d3d0d'); sg.addColorStop(0.5,'#1e6e1e'); sg.addColorStop(1,'#0d3d0d');
  ctx.beginPath();
  ctx.rect(bx-wKnot*0.45,yKnot,wKnot*0.9,yBot-yKnot);
  ctx.fillStyle=sg; ctx.fill();

  // Cinta dorada
  const rg=ctx.createLinearGradient(0,yKnot,0,yKnot+ribbonH);
  rg.addColorStop(0,'#f5e6c0'); rg.addColorStop(0.3,'#e8cc88');
  rg.addColorStop(0.7,'#c8a840'); rg.addColorStop(1,'#a08020');
  ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.rect(bx-wKnot*1.1,yKnot,wKnot*2.2,ribbonH);
  ctx.fillStyle=rg; ctx.fill();
  ctx.beginPath(); ctx.rect(bx-wKnot*1.1,yKnot,wKnot*2.2,ribbonH*0.38);
  ctx.fillStyle='rgba(255,248,200,0.4)'; ctx.fill();
  ctx.shadowBlur=0;

  // Moño
  const bowCX=bx, bowCY=yKnot+ribbonH*0.5;
  const bw=unit*0.32, bh=unit*0.17;
  for (const [tx,ty,rot] of [[-bw*0.55,-bh*0.15,-0.42],[bw*0.55,-bh*0.15,0.42]]) {
    ctx.save();
    ctx.translate(bowCX+tx,bowCY+ty); ctx.rotate(rot);
    const bg2=ctx.createRadialGradient(-bw*0.1,-bh*0.1,0,0,0,bw*0.8);
    bg2.addColorStop(0,'#fff0b0'); bg2.addColorStop(0.4,'#e8c840');
    bg2.addColorStop(0.8,'#b09020'); bg2.addColorStop(1,'#806010');
    ctx.beginPath(); ctx.ellipse(0,0,bw*0.72,bh*0.52,0,0,Math.PI*2);
    ctx.fillStyle=bg2; ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=7; ctx.fill();
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.moveTo(-bw*0.65,0); ctx.quadraticCurveTo(0,-bh*0.15,bw*0.65,0);
    ctx.strokeStyle='rgba(120,80,0,0.25)'; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  }
  // Extremos cinta
  for (const side of [-1,1]) {
    ctx.beginPath();
    ctx.moveTo(bowCX+side*bw*0.12,bowCY+bh*0.3);
    ctx.bezierCurveTo(bowCX+side*bw*0.25,bowCY+bh*1.2,bowCX+side*bw*0.45,bowCY+bh*1.8,bowCX+side*bw*0.35,bowCY+bh*2.6);
    ctx.lineWidth=ribbonH*0.55; ctx.strokeStyle='#d4b040'; ctx.lineCap='round';
    ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=3; ctx.stroke();
    ctx.shadowBlur=0;
  }
  // Centro moño
  const cg2=ctx.createRadialGradient(bowCX-bw*0.05,bowCY-bh*0.05,0,bowCX,bowCY,bw*0.22);
  cg2.addColorStop(0,'#fff5c0'); cg2.addColorStop(0.5,'#e8c840'); cg2.addColorStop(1,'#a07820');
  ctx.shadowColor='rgba(0,0,0,0.45)'; ctx.shadowBlur=5;
  ctx.beginPath(); ctx.arc(bowCX,bowCY,bw*0.20,0,Math.PI*2); ctx.fillStyle=cg2; ctx.fill();
  ctx.beginPath(); ctx.arc(bowCX-bw*0.07,bowCY-bh*0.15,bw*0.08,0,Math.PI*2);
  ctx.fillStyle='rgba(255,250,200,0.55)'; ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
}

// ================================================================
//  LUCIÉRNAGAS — menos en móvil
// ================================================================
const FF_COUNT = isMobile ? 10 : 18;
const fireflies = Array.from({length:FF_COUNT}, () => ({
  x:rand(0.05,0.95), y:rand(0.15,0.75),
  vx:rand(-0.04,0.04), vy:rand(-0.03,0.03),
  phase:rand(0,Math.PI*2), speed:rand(0.6,1.4), r:rand(1.8,3.2)
}));
function updateFireflies() {
  for (const f of fireflies) {
    f.x+=f.vx*0.012; f.y+=f.vy*0.012+Math.sin(elapsed*0.7+f.phase)*0.0008;
    if (f.x<0.02||f.x>0.98) f.vx*=-1;
    if (f.y<0.05||f.y>0.78) f.vy*=-1;
    const a=0.4+0.6*(0.5+0.5*Math.sin(elapsed*f.speed*2+f.phase));
    ctx.beginPath(); ctx.arc(f.x*W,f.y*H,f.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(180,255,120,${(a*0.9).toFixed(2)})`;
    ctx.shadowColor='#aaff44'; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0;
  }
}

// ================================================================
//  MARIPOSAS
// ================================================================
const butterflies = Array.from({length:4}, (_,i) => ({
  angle:rand(0,Math.PI*2), speed:rand(0.22,0.32), wingPhase:rand(0,Math.PI*2),
  colors:[['#ffee44','#ff8800'],['#ff88cc','#cc2288'],['#88eeff','#0088cc'],['#aaffaa','#228822']][i],
  size:rand(7,11), orbitCx:rand(0.32,0.68), orbitCy:rand(0.28,0.55),
  orbitRx:rand(0.06,0.14), orbitRy:rand(0.04,0.08)
}));
function drawButterfly(x,y,size,wingPhase,colors) {
  const open=0.35+0.65*Math.abs(Math.sin(wingPhase));
  const [c1,c2]=colors;
  ctx.save(); ctx.translate(x,y);
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=5;
  for (const side of [-1,1]) {
    ctx.save(); ctx.scale(side,1); ctx.save(); ctx.transform(open,0,0,1,0,0);
    const g=ctx.createRadialGradient(size*0.4,-size*0.3,0,size*0.5,-size*0.2,size*1.0);
    g.addColorStop(0,c1); g.addColorStop(0.55,c2); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.bezierCurveTo(size*0.2,-size*0.9,size*1.1,-size*0.8,size*1.1,-size*0.1);
    ctx.bezierCurveTo(size*1.1,size*0.3,size*0.4,size*0.25,0,0);
    ctx.fillStyle=g; ctx.globalAlpha=0.9; ctx.fill();
    ctx.restore(); ctx.restore();
    ctx.save(); ctx.scale(side,1); ctx.save(); ctx.transform(open*0.85,0,0,1,0,0);
    const g2=ctx.createRadialGradient(size*0.3,size*0.3,0,size*0.4,size*0.35,size*0.85);
    g2.addColorStop(0,c1); g2.addColorStop(0.6,c2); g2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.bezierCurveTo(size*0.15,size*0.2,size*0.9,size*0.15,size*0.95,size*0.55);
    ctx.bezierCurveTo(size*0.9,size*0.9,size*0.2,size*0.85,0,0);
    ctx.fillStyle=g2; ctx.globalAlpha=0.82; ctx.fill();
    ctx.restore(); ctx.restore();
  }
  ctx.shadowBlur=0; ctx.globalAlpha=1;
  ctx.beginPath(); ctx.ellipse(0,0,size*0.07,size*0.48,0,0,Math.PI*2);
  ctx.fillStyle='#2a1500'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,-size*0.5,size*0.1,0,Math.PI*2);
  ctx.fillStyle='#2a1500'; ctx.fill();
  for (const side of [-1,1]) {
    ctx.beginPath(); ctx.moveTo(side*size*0.04,-size*0.55);
    ctx.quadraticCurveTo(side*size*0.35,-size*1.0,side*size*0.28,-size*1.15);
    ctx.strokeStyle='#2a1500'; ctx.lineWidth=0.9; ctx.stroke();
    ctx.beginPath(); ctx.arc(side*size*0.28,-size*1.15,size*0.07,0,Math.PI*2);
    ctx.fillStyle='#2a1500'; ctx.fill();
  }
  ctx.restore();
}
function updateButterflies() {
  for (const b of butterflies) {
    b.angle+=b.speed*0.016; b.wingPhase+=0.14;
    drawButterfly(
      (b.orbitCx+Math.cos(b.angle)*b.orbitRx)*W,
      (b.orbitCy+Math.sin(b.angle*0.65)*b.orbitRy)*H,
      b.size, b.wingPhase, b.colors
    );
  }
}

// ================================================================
//  CORAZONES
// ================================================================
let hearts=[], heartsActive=false;
function spawnHeart(bx,by) {
  if (hearts.length > 25) return; // límite
  hearts.push({
    x:bx+rand(-60,60), y:by-rand(20,60),
    vy:rand(0.8,1.8), vx:rand(-0.4,0.4),
    size:rand(8,18), alpha:1,
    color:['#ff4488','#ff6644','#ffcc00','#ff88aa'][Math.floor(rand(0,4))],
    rot:rand(-0.5,0.5)
  });
}
function drawHeart(x,y,size,color,alpha) {
  ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=color;
  ctx.shadowColor=color; ctx.shadowBlur=7;
  ctx.beginPath();
  ctx.moveTo(x,y+size*0.3);
  ctx.bezierCurveTo(x,y,x-size,y,x-size,y+size*0.4);
  ctx.bezierCurveTo(x-size,y+size*0.9,x,y+size*1.3,x,y+size*1.6);
  ctx.bezierCurveTo(x,y+size*1.3,x+size,y+size*0.9,x+size,y+size*0.4);
  ctx.bezierCurveTo(x+size,y,x,y,x,y+size*0.3);
  ctx.fill(); ctx.shadowBlur=0; ctx.restore();
}
function updateHearts(bx,by) {
  if (!heartsActive) return;
  if (Math.random()<0.07) spawnHeart(bx,by);
  hearts=hearts.filter(h=>h.alpha>0.02);
  for (const h of hearts) {
    h.y-=h.vy; h.x+=h.vx+Math.sin(elapsed*2+h.rot)*0.3; h.alpha-=0.006;
    drawHeart(h.x,h.y,h.size,h.color,Math.max(0,h.alpha));
  }
}

// ================================================================
//  POLEN
// ================================================================
let pollenParticles=[], pollenActive=false;
function spawnPollen(bx,by,sc) {
  if (pollenParticles.length > 40) return; // límite
  const unit=sc*80;
  const def=FLOWER_DEFS[Math.floor(rand(0,FLOWER_DEFS.length))];
  pollenParticles.push({
    x:bx+def.ox*unit*0.9+rand(-12,12), y:by+def.oy*unit*0.9+rand(-12,12),
    vx:rand(-0.5,0.5), vy:rand(-0.3,0.1), r:rand(1.5,3.0),
    alpha:rand(0.7,1.0), hue:rand(40,58)
  });
}
function updatePollen(bx,by,sc) {
  if (!pollenActive) return;
  if (Math.random()<0.15) spawnPollen(bx,by,sc);
  pollenParticles=pollenParticles.filter(p=>p.alpha>0.02);
  for (const p of pollenParticles) {
    p.x+=p.vx+Math.sin(elapsed*1.5+p.x)*0.15;
    p.y+=p.vy+0.18; p.vy+=0.012; p.alpha-=0.004;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle=`hsla(${p.hue},95%,65%,${p.alpha.toFixed(2)})`;
    ctx.shadowColor=`hsl(${p.hue},100%,70%)`; ctx.shadowBlur=4; ctx.fill(); ctx.shadowBlur=0;
  }
}

// ================================================================
//  EASE
// ================================================================
function easeOutBack(t) {
  const c1=1.70158, c3=c1+1;
  return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);
}

// ================================================================
//  LOOP PRINCIPAL
// ================================================================
let msgShown=false;

function frame(ts) {
  if (!t0) t0=ts;
  elapsed=(ts-t0)/1000;
  ctx.clearRect(0,0,W,H);

  drawBackground();
  drawStars();
  updateFireflies();

  const bx=BX(), by=BY(), sc=SC(), unit=sc*80;

  // 1. Papel de fondo
  drawWrapperBack(bx,by,sc);

  // 2. Tallos y hojas
  for (let i=0; i<FLOWER_DEFS.length; i++) {
    const def=FLOWER_DEFS[i], st=flowerState[i];
    const age=elapsed-def.delay;
    if (age<0) continue;
    st.stemT=clamp(age/1.6,0,1);
    if (st.stemT>=0.8) { st.scale=clamp((age-1.3)/0.55,0,1); st.scale=easeOutBack(st.scale); }
    const fx=bx+def.ox*unit*0.9, fy=by+def.oy*unit*0.9;
    drawStem(bx,by-unit*0.55,fx,fy,st.stemT,sc*4.2,`hsl(${118+i*4},58%,${20+i}%)`);
    if (st.stemT>0.45) {
      const lt=clamp((st.stemT-0.45)/0.55,0,1);
      const lx=lerp(bx,fx,0.52), ly=lerp(by-unit*0.55,fy,0.52);
      const leafSize=unit*0.52*lt;
      const leafAngle=Math.atan2(fy-(by-unit*0.55),fx-bx)+Math.PI/2;
      drawLeaf(lx,ly,leafAngle+0.45,leafSize,false);
      drawLeaf(lx,ly,leafAngle-0.45,leafSize,true);
    }
  }

  // 3. Flores
  let allDone=true;
  for (let i=0; i<FLOWER_DEFS.length; i++) {
    const def=FLOWER_DEFS[i], st=flowerState[i];
    const age=elapsed-def.delay;
    if (age<0) { allDone=false; continue; }
    if (st.stemT<1||st.scale<1) allDone=false;
    if (st.scale>0) {
      const fx=bx+def.ox*unit*0.9, fy=by+def.oy*unit*0.9;
      const sway=Math.sin(elapsed*(1.7+i*0.18)+i)*0.038*(i%2===0?1:-1);
      const r=def.size*unit*0.60*st.scale;
      def.type==='rose' ? drawRose(fx,fy,r*0.82,sway) : drawSunflower(fx,fy,r,sway);
    }
  }

  // 4. Mariposas
  updateButterflies();

  // 5. Cinta y moño
  drawWrapperFront(bx,by,sc);

  // 6. Efectos finales
  if (allDone&&!msgShown) { msgShown=true; heartsActive=true; pollenActive=true; }
  updateHearts(bx,by);
  updatePollen(bx,by,sc);

  drawGrass();
  requestAnimationFrame(frame);
}

// El loop arranca desde startExperience() al tocar el botón
