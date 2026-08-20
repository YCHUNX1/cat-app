// ============================================
//  像素长毛金渐层"羊毛" + 男主人 + 女主人
//  男女主人一起互动
// ============================================
(function () {
  // 逻辑网格（放大以容纳三人和动画）
  const W = 60, H = 44;
  let canvas, ctx, cell = 10;
  let stage;

  // ===== 调色板 =====
  const PAL = {
    // 金渐层猫
    outline: '#2a2018',
    fur: '#e8c27a',       // 金渐层主体（暖金）
    furL: '#f3d9a4',      // 浅金高光
    furD: '#c49a52',      // 深金
    furTip: '#9c7a3c',    // 毛尖深色（金渐层特征）
    belly: '#fbf0d9',
    earIn: '#f0c9a5',
    nose: '#e88a9a',
    eye: '#2a2a2a', iris: '#3aa05b',
    blush: '#ff9a9a', white: '#ffffff',
    // 男主人
    mHair: '#2b2b33', mSkin: '#f2c9a4', mShirt: '#4a7fb5', mPants: '#3a3a46',
    // 女主人
    fHair: '#8a5a2e', fSkin: '#f6d0ac', fDress: '#f0889a', fBow: '#e06070', fShoe: '#e8d8f0',
    // 其它
    star: '#ffd94d', water: '#7fd0f0', bubble: '#c8efff',
  };

  // 状态
  const state = { act: 'idle', actT: 0, frame: 0, expr: 'normal', blink: 0, dizzy: 0, starAnim: 0 };
  const P = { bodyY:0, headY:0, headX:0, tailA:0, squash:1, eyeH:0, eyeOpenH:3,
    legL:[0,0], legR:[0,0], earL:0, earR:0, headW:12 };
  // 双人互动参数
  const D = { mArm:0, fArm:0, mReach:0, fReach:0, foodX:0, foodY:0 };

  const particles = [];
  function spawnParticle(o){ particles.push({x:o.x,y:o.y,vx:o.vx||0,vy:o.vy||0,w:o.w||1,h:o.h||1,color:o.color,life:o.life||1,maxLife:o.life||1,type:o.type||'water',wob:Math.random()*6.28}); }
  function updateParticles(dt){ for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.wob+=dt*4; p.life-=dt; if(p.type==='bubble'){p.x+=Math.sin(p.wob)*0.8*dt;p.vy-=1.8*dt;} if(p.life<=0)particles.splice(i,1);} }
  function drawParticles(){ for(const p of particles){ const tw=Math.max(0.6,p.w*(p.life/p.maxLife)); px(p.x,p.y,tw,p.type==='bubble'?tw:p.h,p.color); } }

  let raf=null,lastT=0, bathTimer=0;

  function px(x,y,w,h,color){ if(!color)return; ctx.fillStyle=color; const cx=Math.round(x),cy=Math.round(y); ctx.fillRect(cx*cell,cy*cell,Math.max(1,Math.round((w||1)*cell)),Math.max(1,Math.round((h||1)*cell))); }
  function rect(x,y,w,h,c){ px(x,y,w,h,c); }

  function init(el){
    stage=el; canvas=document.createElement('canvas'); stage.appendChild(canvas); ctx=canvas.getContext('2d');
    if(!ctx)return false; resize(); window.addEventListener('resize',resize); lastT=performance.now(); raf=requestAnimationFrame(loop); return true;
  }
  function resize(){ const r=stage.getBoundingClientRect(); cell=Math.max(5,Math.floor(Math.min(r.height/H, r.width/W))); canvas.width=W*cell; canvas.height=H*cell; canvas.style.width=(W*cell)+'px'; canvas.style.height=(H*cell)+'px'; }

  function loop(now){ raf=requestAnimationFrame(loop); const dt=(now-lastT)/1000; lastT=now; state.frame++; if(state.blink>0)state.blink-=dt; else if(Math.random()<0.002)state.blink=0.12; if(state.dizzy>0){state.dizzy-=dt;state.starAnim+=dt*6;} updateParticles(dt); draw(); }

  function setAct(name){ if(state.act===name)return; state.act=name; state.actT=0; }
  function playAct(name,dur){ state.act=name; state.actT=0; state.actDur=dur||1.2; }

  // ===== 背景 =====
  function drawBackground(){
    for(let gx=0; gx<W; gx+=2){ px(gx,H-6,2,6,(gx/2)%2===0?'#3f3a55':'#373350'); }
    px(0,H-7,W,1,'#0f0f1a');
  }

  // ===== 绘制主流程 =====
  function draw(){
    if(!ctx)return; state.actT+=1/60;
    ctx.clearRect(0,0,W*cell,H*cell);
    drawBackground();
    updatePose();
    // 绘制顺序：后景主人 → 猫 → 前景主人
    drawOwnersBack();
    drawTail();
    drawLegs();
    drawBody();
    drawHead();
    drawEar();
    drawFace();
    drawOwnersFront();
    drawCatProps();
    drawParticles();
  }

  // ===== 金渐层羊毛：身体 =====
  function drawBody(){
    const cx=W/2+P.headX*0.2, by=H-9-P.bodyY, bw=17, bh=12*P.squash;
    rect(cx-6,by-bh+2,12,bh-2,PAL.belly);
    rect(cx-bw/2,by-bh,bw,bh,PAL.fur);
    rect(cx-bw/2,by-bh,bw,3,PAL.furL);
    // 长毛底部（毛茸茸）
    px(cx-bw/2,by-bh+bh-1,bw,1,PAL.furD);
    px(cx-bw/2-1,by-bh+bh-2,2,2,'#e8c27a');
    px(cx+bw/2-1,by-bh+bh-2,2,2,'#e8c27a');
    // 金渐层毛尖深色
    for(let i=0;i<3;i++) px(cx-bw/2+2+i*5,by-bh+4,3,2,PAL.furTip);
  }

  // ===== 金渐层头（圆脸+蓬松） =====
  function drawHead(){
    const hx=W/2+P.headX, hy=H-20-P.headY, s=12;
    // 蓬松圆脸（大号金渐变）
    rect(hx-s-1,hy-10,s*2+2,12,PAL.furL);
    rect(hx-s,hy-12,s*2,3,PAL.furL);
    rect(hx-s,hy, s*2,3,PAL.fur);
    rect(hx-s,hy-8,s*2,8,PAL.fur);
    // 脸颊毛（金渐层蓬松）
    px(hx-s-3,hy-5,2,6,PAL.furL);
    px(hx-s-2,hy-8,2,3,PAL.fur);
    px(hx+s+1,hy-5,2,6,PAL.furL);
    px(hx+s,hy-8,2,3,PAL.fur);
    // 下巴白
    rect(hx-5,hy+2,10,3,PAL.belly);
    // 蝴蝶结
    px(hx-2,hy-14,2,2,'#ff6f92');
    px(hx-6,hy-16,3,3,'#ff6f92');
    px(hx+3,hy-16,3,3,'#ff6f92');
  }

  function drawEar(){
    const hx=W/2+P.headX, hy=H-20-P.headY;
    // 金渐层圆耳（带毛）
    px(hx-10,hy-16-P.earL,6,7,PAL.fur);
    px(hx-9,hy-15-P.earL,4,4,PAL.earIn);
    px(hx+4,hy-16-P.earR,6,7,PAL.fur);
    px(hx+5,hy-15-P.earR,4,4,PAL.earIn);
  }

  function drawFace(){
    const hx=W/2+P.headX, hy=H-20-P.headY;
    const blinkOn=state.blink>0||state.act==='sleep';
    const enjoying=(state.act==='pet'||state.act==='bath'||state.expr==='happy');
    const eyeY=hy-4+P.eyeH;
    if(enjoying){
      // 眯眼（U 形弧线，幸福享受）
      px(hx-7,eyeY,3,1,'#2a2018'); px(hx-7,eyeY-1,1,1,'#2a2018'); px(hx-5,eyeY-1,1,1,'#2a2018');
      px(hx+3,eyeY,3,1,'#2a2018'); px(hx+3,eyeY-1,1,1,'#2a2018'); px(hx+5,eyeY-1,1,1,'#2a2018');
    }
    else if(blinkOn){ px(hx-6,eyeY,3,1,PAL.outline); px(hx+3,eyeY,3,1,PAL.outline); }
    else{
      px(hx-7,eyeY-2, P.eyeOpenH===1?1:4, P.eyeOpenH, PAL.eye);
      // 绿瞳
      px(hx-6,eyeY-2,2,2,PAL.iris); px(hx+4,eyeY-2,2,2,PAL.iris);
    }
    // 腮红
    px(hx-9,hy-2,3,2,PAL.blush); px(hx+6,hy-2,3,2,PAL.blush);
    // 鼻+嘴
    px(hx-1,hy-1,2,1,PAL.nose);
    if(state.expr==='happy'||state.act==='pet'||state.act==='bath'){ px(hx-2,hy+1,4,1,'#2a2018'); px(hx-3,hy+2,6,1,'#2a2018'); }
    else if(state.expr==='sad'){ px(hx-2,hy+2,4,1,'#2a2018'); }
    else { px(hx-1,hy+1,2,1,'#2a2018'); }
    // 胡须
    px(hx-13,hy-2,4,1,PAL.furD); px(hx+9,hy-2,4,1,PAL.furD);
  }

  function drawLegs(){
    const cx=W/2, by=H-9-P.bodyY;
    [[-5,P.legL],[5,P.legR]].forEach(([ox,leg])=>{
      px(cx+ox+(leg[0]||0), by-2-(leg[1]||0), 4,2,PAL.furD);
    });
    px(cx-5,by,4,1,PAL.furL); px(cx+1,by,4,1,PAL.furL);
  }
  function drawTail(){
    const cx=W/2, bx=cx+10, byc=H-9-P.bodyY, a=P.tailA||0;
    const tx=bx+Math.cos(a)*6, ty=byc-3+Math.sin(a)*6;
    px(bx,byc-3,3,3,PAL.fur); px(tx,ty-1,3,3,PAL.fur); px(tx+1,ty-2,2,2,PAL.furTip);
  }

  // ===== 男女主人 =====
  function drawOwnersBack(){
    // 女主人右侧（后层部分）
    if(state.act==='walk'||state.act==='run') drawOwner(1,'f',false);
  }
  function drawOwnersFront(){
    if(state.act!=='walk'&&state.act!=='run') drawOwner(1,'f',false);
    drawOwner(-1,'m',true);
  }
  // 画主人：side=-1 左(男) / 1 右(女)，layer 控制手臂
  function drawOwner(side, who){
    const ox=W/2+side*20;
    const gy=H-9;
    // 互动时朝向猫伸出手
    const reaching = (state.act==='eat'||state.act==='pet'||state.act==='bath'||state.act==='play');
    if(who==='m'){
      rect(ox-4,gy-14,8,11,PAL.mShirt);
      rect(ox-4,gy-3,8,3,PAL.mPants);
      px(ox-4,gy,3,1,PAL.mPants); px(ox+1,gy,3,1,PAL.mPants);
      rect(ox-3,gy-21,6,6,PAL.mSkin);
      rect(ox-3,gy-22,6,3,PAL.mHair);
      rect(ox-4,gy-21,1,2,PAL.mHair);
      px(ox-2,gy-18,1,1,'#333'); px(ox+1,gy-18,1,1,'#333');
      // 男主人朝右（向猫）伸手
      if(reaching){
        // 手臂：从身体右侧伸出朝向中间猫
        px(ox+2,gy-13,2,3,PAL.mShirt);
        px(ox+4+6,gy-12,8,2,PAL.mShirt);  // 横伸的手臂
        px(ox+4+12,gy-12,2,2,PAL.mSkin);   // 手
      } else {
        px(ox-4,gy-11,2,5,PAL.mShirt);
      }
    } else { // 女
      rect(ox-4,gy-14,8,11,PAL.fDress);
      rect(ox-5,gy-5,10,5,PAL.fDress);
      px(ox-3,gy,2,1,PAL.fShoe); px(ox+1,gy,2,1,PAL.fShoe);
      rect(ox-3,gy-21,6,6,PAL.fSkin);
      rect(ox-4,gy-21,8,7,PAL.fHair);
      rect(ox-3,gy-16,2,4,PAL.fHair);
      rect(ox+1,gy-16,2,4,PAL.fHair);
      px(ox-2,gy-18,1,1,'#333'); px(ox+1,gy-18,1,1,'#333');
      px(ox+1,gy-23,2,2,PAL.fBow);
      // 女主人朝左（向猫）伸手
      if(reaching){
        px(ox-2,gy-13,2,3,PAL.fSkin);
        px(ox-2-6,gy-12,8,2,PAL.fDress);
        px(ox-2-12,gy-12,2,2,PAL.fSkin);
      } else {
        px(ox+2,gy-11,2,5,PAL.fDress);
      }
    }
  }

  // 猫的道具（互动时主人递的食物/物品）
  function drawCatProps(){
    if(state.act==='eat'){
      // 两个主人各递一个碗/食物
      const my=H-8;
      px(W/2-11,my,5,2,'#8a5a2a'); px(W/2+6,my,5,2,'#8a5a2a');
      px(W/2-11,my-2,5,1,'#ffd94d'); px(W/2+6,my-2,5,1,'#ffd94d');
      px(W/2-10,my-3,3,1,'#f59e3a'); px(W/2+7,my-3,3,1,'#f59e3a');
    }
  }

  // ===== 动作 =====
  function updatePose(){
    const t=state.actT, f=Math.floor(state.frame/6);
    Object.assign(P,{bodyY:0,headY:0,headX:0,tailA:Math.sin(state.frame/20)*0.4,legL:[0,0],legR:[0,0],eyeH:0,eyeOpenH:3,earL:0,earR:0,headW:12,squash:1});
    Object.assign(D,{mArm:0,fArm:0,mReach:0,fReach:0});

    switch(state.act){
      case 'idle':
        P.bodyY=Math.sin(state.frame/18)*0.8; P.headY=Math.sin(state.frame/18)*0.15;
        P.squash=1+Math.sin(state.frame/18)*0.04; P.tailA=Math.sin(state.frame/22)*0.6;
        break;
      case 'walk': addWalk(f,1.0); break;
      case 'run': addWalk(f,2.2); P.bodyY=Math.sin(f)*1.2; break;
      case 'sleep':
        P.squash=0.8; P.bodyY=1.2; P.headY=0.6; P.legL=[0,2]; P.legR=[0,2];
        if(Math.floor(state.frame/30)%2===0){ px(W/2+8,H-27,3,2,'#9ad0ff'); px(W/2+11,H-30,2,2,'#9ad0ff'); }
        break;
      case 'eat':
        P.headY=-9+Math.sin(state.frame/1.6)*0.6; P.headX=-1.5; P.eyeH=1; P.eyeOpenH=1; P.bodyY=0.5;
        P.legL=[1,0]; P.legR=[-1,0];
        // 男女主人一起递食物（伸手）
        D.mArm=5; D.fArm=5; D.mReach=1; D.fReach=1;
        break;
      case 'bath':
        P.eyeH=0; P.eyeOpenH=1; P.headY=0.2; P.bodyY=0.5;
        bathTimer+=1/60;
        // 主人递花洒/沐浴露
        D.mArm=4; D.fArm=4;
        // 花洒（左主人举着喷）
        px(W/2-16,H-26,6,3,'#9aa0b8'); px(W/2-14,H-29,2,3,'#666c84');
        if(state.frame%2===0){ for(let i=0;i<3;i++) spawnParticle({x:W/2-13+(Math.random()*4-2),y:H-25,vy:8,w:1,h:1.3,color:PAL.water,life:1.1}); }
        // 泡泡更多
        if(state.frame%4===0) spawnParticle({x:W/2+(Math.random()*14-7),y:H-6,vx:Math.random()*2-1,w:1.6,h:1.6,color:PAL.bubble,life:1.8,type:'bubble'});
        if(Math.random()<0.4) spawnParticle({x:W/2-5+Math.random()*10,y:H-8,vx:Math.random()*2-1,w:1.3,h:1.3,color:'#dff4ff',life:1.5,type:'bubble'});
        break;
      case 'pet':
        P.eyeH=0; P.eyeOpenH=1; P.headY=0.3; P.headX=Math.sin(state.frame/30)*0.6;
        // 男女主人一起伸手摸
        D.mArm=6; D.fArm=6; D.mReach=1; D.fReach=1;
        break;
      case 'play':
        P.bodyY=Math.abs(Math.sin(t*Math.PI*2/0.6))*4*0.9; P.headY=P.bodyY*0.9;
        P.tailA=Math.sin(state.frame/5)*0.8;
        // 女主人扔球，男主人逗
        D.mArm=5; D.fArm=6;
        const bX=W/2+Math.sin(state.frame/8)*12, bY=H-8-Math.abs(Math.sin(state.frame/4))*6;
        px(bX,bY,3,3,'#ff6f92');
        break;
      case 'dizzy':
        P.squash=0.9; P.bodyY=Math.sin(state.frame/3)*1.5; P.headY=Math.sin(state.frame/3)*0.8; P.eyeOpenH=1;
        const sc=Math.cos(state.frame/6)*6, sy=Math.sin(state.frame/6)*6;
        px(W/2+sc,H-22+sy,3,3,PAL.star); px(W/2-sc,H-22-sy,3,3,PAL.star);
        break;
    }
    if(state.act!=='idle'&&state.actT>(state.actDur||1.2)){ state.act='idle'; state.actT=0; }
  }
  function addWalk(f,speed){
    const st=Math.sin(f*Math.PI*2*speed);
    P.legL=[Math.round(st*3),Math.max(0,st)*2]; P.legR=[Math.round(-st*3),Math.max(0,-st)*2];
    P.bodyY=Math.abs(st)*0.6; P.headY=Math.abs(st)*0.2; P.tailA=st*0.5;
  }

  // 对外接口
  window.PixCat = {
    init, play: playAct, setAct,
    setExpr:function(e){state.expr=e;},
    setDizzy:function(){ state.dizzy=1.5; state.act='dizzy'; state.actT=0; state.actDur=1.5; },
    getState:function(){return {act:state.act,expr:state.expr};}
  };
})();
