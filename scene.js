import * as T from './vendor/three.module.js';
import {clamp,lerp,phase,kernelGeometry,grainTexture,makeEar,makeBag,random} from './models.js';
import {Cinema,makeAtmosphere,makeScience,sampleCamera} from './cinema.js';
import {loadSurfaces} from './environment.js';
import {makePlant} from './botany.js';
import {makeEarth} from './terrain.js';

const stage=document.querySelector('.stage'),sections=[...document.querySelectorAll('section')],copies=[...document.querySelectorAll('.copy')],dots=[...document.querySelectorAll('nav button')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const names=['THE SEED','TAKING ROOT','THE GROWTH','THE KERNEL','THE POTENTIAL','PIONEER'];
let target=0,current=0,lastTime=0,frameId=0,renderer;
const pointer=new T.Vector2(),pointerSmooth=new T.Vector2();

function progress(){let i=0;while(i<sections.length-1&&scrollY>=sections[i+1].offsetTop)i++;target=i+clamp((scrollY-sections[i].offsetTop)/Math.max(1,sections[i].offsetHeight));}
function updateCopy(p) {
  copies.forEach((copy,i)=>{
    const opacity=i===0?1-phase(p,.35,.65):phase(p,i-.26,i-.02)*(i===5?1:1-phase(p,i+.42,i+.72));
    copy.style.opacity=opacity;copy.inert=opacity<.08;copy.setAttribute('aria-hidden',String(opacity<.08));
    copy.style.transform=`translateY(${(1-opacity)*18}px)`;
  });
  const index=clamp(Math.floor(p+.22),0,5);
  dots.forEach((dot,i)=>{dot.classList.toggle('active',i===index);dot.setAttribute('aria-current',i===index?'step':'false');});
  document.querySelector('#chapter-name').textContent=names[index];document.querySelector('#number').textContent=String(index+1).padStart(2,'0');
  document.documentElement.style.setProperty('--progress',`${clamp(p/5.2)*100}%`);
}

document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>sections[Number(button.dataset.go)].scrollIntoView({behavior:reduced?'instant':'smooth'})));
addEventListener('scroll',progress,{passive:true});
addEventListener('pointermove',event=>{pointer.set(event.clientX/innerWidth-.5,event.clientY/innerHeight-.5);},{passive:true});

function fallback(error) {
  console.error('Unable to start the 3D scene:',error);
  document.body.classList.add('no-webgl');
  stage.innerHTML='<img class="fallback-art" src="assets/plant.png" alt="Corn plant with a mature ear"><p class="graphics-notice">The 3D scene could not start. Reload the page to try again.</p>';
  function staticFrame(){progress();updateCopy(target);requestAnimationFrame(staticFrame);}staticFrame();
}

try {
  renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.35:1.75,Math.sqrt(3600000/(innerWidth*innerHeight))));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  renderer.info.autoReset=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000,0);stage.replaceChildren(renderer.domElement);stage.insertAdjacentHTML('beforeend','<div class="scene-loading"><span></span>Preparing a world of possibility</div>');
  renderer.domElement.setAttribute('aria-label','Three-dimensional corn journey, controlled by scrolling');
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frameId);document.body.classList.add('graphics-paused');});
  renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());

  const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.08,80);
  const world=new T.Group();scene.add(world);
  const surfaces=await loadSurfaces(renderer);
  const atmosphere=makeAtmosphere();scene.add(atmosphere.sky);
  const cinema=new Cinema(renderer,scene,camera);
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw new Error(gl.getProgramInfoLog(program)||gl.getShaderInfoLog(fragment)||'Shader compilation failed')};
  const screenSize=new T.Vector2();renderer.getDrawingBufferSize(screenSize);cinema.resize(screenSize.x,screenSize.y);

  const ambient=new T.HemisphereLight('#fff9df','#65764b',.85);scene.add(ambient);
  const sun=new T.DirectionalLight('#fff2c6',3.1);sun.position.set(-3,7,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-6;sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;sun.shadow.radius=4;scene.add(sun);
  const rim=new T.DirectionalLight('#ffffff',2.2);rim.position.set(4,3,-4);scene.add(rim);
  const fill=new T.DirectionalLight('#f3ffe1',.6);fill.position.set(1,-1,5);scene.add(fill);

  const studio=new T.Scene();studio.background=new T.Color('#e7dfc8');
  for(const [x,y,z,s] of [[-4,5,3,7],[5,2,2,5],[1,4,-5,4]]) {
    const panel=new T.Mesh(new T.PlaneGeometry(s,s),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,0,0);studio.add(panel);
  }
  const pmrem=new T.PMREMGenerator(renderer);const env=pmrem.fromScene(studio,.06);scene.environment=env.texture;scene.environmentIntensity=.38;pmrem.dispose();

  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:'#726632',opacity:.13}));floor.rotation.x=-Math.PI/2;floor.position.y=-4.4;floor.receiveShadow=true;scene.add(floor);
  const geometry=kernelGeometry(),bump=grainTexture();
  const kernelMaterial=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.68,roughnessMap:bump,metalness:0,clearcoat:.18,clearcoatRoughness:.32,bumpMap:bump,bumpScale:.009,envMapIntensity:.8});
  const seed=new T.Mesh(geometry,kernelMaterial.clone());seed.castShadow=true;world.add(seed);
  const wire=new T.Mesh(kernelGeometry(16),new T.MeshBasicMaterial({color:'#829650',wireframe:true,transparent:true,opacity:.6}));seed.add(wire);wire.scale.setScalar(1.008);
  const plant=makePlant(surfaces);plant.group.position.y=-1.65;world.add(plant.group);
  const soil=makeEarth(surfaces);soil.group.position.y=-1.65;world.add(soil.group);
  const ear=makeEar(kernelGeometry(28),kernelMaterial,surfaces);ear.group.position.set(.16,.4,.25);ear.group.rotation.set(.06,.12,-.33);world.add(ear.group);
  const hero=new T.Mesh(geometry,kernelMaterial);hero.castShadow=true;world.add(hero);
  const science=makeScience(geometry);world.add(science.group);
  const bag=makeBag();world.add(bag.group);

  const dustGeo=new T.BufferGeometry(),dustPos=new Float32Array(65*3),rng=random(143);
  for(let i=0;i<dustPos.length;i+=3){dustPos[i]=(rng()-.5)*9;dustPos[i+1]=(rng()-.5)*9;dustPos[i+2]=(rng()-.5)*5-2;}
  dustGeo.setAttribute('position',new T.BufferAttribute(dustPos,3));
  const dust=new T.Points(dustGeo,new T.PointsMaterial({color:'#fff9c1',size:.027,transparent:true,opacity:.5,depthWrite:false}));scene.add(dust);

  const earPosition=new T.Vector3(),startQuaternion=new T.Quaternion(),endQuaternion=new T.Quaternion(),look=new T.Vector3(),cameraPosition=new T.Vector3();
  const heroDestination=new T.Vector3(),baseScale=new T.Vector3(.115,.075,.125),largeScale=new T.Vector3(),packEntry=new T.Vector3(.15,1.72,.03);
  const restColor=new T.Color('#ebe4b9'),goldColor=new T.Color('#ffffff');
  const reusableEuler=new T.Euler();
  const surfaceLine=new T.Vector3();
  const inkDay=new T.Color('#193a2b'),inkNight=new T.Color('#f5f4dc'),ink=new T.Color(),focusPoint=new T.Vector3(),focusView=new T.Vector3();

  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.35:1.75,Math.sqrt(3600000/(innerWidth*innerHeight))));renderer.setSize(innerWidth,innerHeight);renderer.getDrawingBufferSize(screenSize);cinema.resize(screenSize.x,screenSize.y);progress();}
  addEventListener('resize',resize);

  function draw(timestamp=0) {
    const dt=Math.min(.05,(timestamp-lastTime)/1000||.016);lastTime=timestamp;
    current=reduced?target:lerp(current,target,1-Math.exp(-dt*7));const p=current;
    const mobile=innerWidth<700,time=reduced?0:timestamp*.001;
    pointerSmooth.lerp(pointer,reduced?0:.035);
    updateCopy(p);
    const night=phase(p,2.62,3.32)*(1-phase(p,4.59,5.12));
    atmosphere.update(night,time);ambient.intensity=lerp(.85,.26,night);sun.intensity=lerp(3.1,2.1,night);rim.color.set(night>.5?'#b9ffbd':'#ffffff');rim.intensity=lerp(2.2,3.4,night);
    ink.copy(inkDay).lerp(inkNight,night);document.documentElement.style.setProperty('--ink',ink.getStyle());document.documentElement.style.setProperty('--night',night);document.documentElement.style.setProperty('--accent',night>.5?'#c8df79':'#667e35');


    const materialize=phase(p,.03,.33),bury=phase(p,.3,.85);
    seed.material.color.copy(restColor).lerp(goldColor,materialize);seed.material.roughness=lerp(.94,.66,materialize);seed.material.clearcoat=materialize*.24;seed.material.transparent=materialize<.999;seed.material.opacity=lerp(.09,1,materialize);
    wire.material.opacity=(1-materialize)*.13;wire.visible=materialize<.999;
    seed.visible=p<1.38;seed.position.set(0,lerp(.9,-1.72,bury),.11);seed.scale.setScalar(lerp(1.35,.29,bury)*(1-phase(p,1.05,1.4)));
    seed.rotation.set(.12+bury*.35,lerp(-.48,.75,bury)+Math.sin(time*.35)*.035,-.2+bury*.46);
    plant.update(p,time);soil.update(p);ear.update(p);
    plant.group.rotation.y=Math.sin(time*.32)*.02;

    const focus=phase(p,2.3,2.94),extract=phase(p,2.98,3.62),turn=phase(p,3.72,4.48),finish=phase(p,4.6,5.08);
    ear.group.updateWorldMatrix(true,false);earPosition.copy(ear.selectedLocal);ear.group.localToWorld(earPosition);
    world.worldToLocal(earPosition);ear.group.getWorldQuaternion(startQuaternion);
    hero.visible=p>1.95&&p<5.08;
    heroDestination.set(lerp(0,mobile?0:-2.55,turn),.42,1.2);
    hero.position.copy(earPosition).lerp(heroDestination,extract);
    const size=lerp(1,1.75,extract);largeScale.setScalar(size);hero.scale.copy(baseScale).multiplyScalar(ear.group.scale.x).lerp(largeScale,extract);
    reusableEuler.set(lerp(.06,-.12,extract),-.28+turn*Math.PI*1.72+pointerSmooth.x*.2*extract,lerp(-.33,-.12,extract)+turn*.15);endQuaternion.setFromEuler(reusableEuler);hero.quaternion.copy(startQuaternion).slerp(endQuaternion,extract);
    hero.position.y+=Math.sin(time*.9)*.035*extract*(1-finish);
    if(finish>0){hero.position.lerp(packEntry,finish);hero.scale.multiplyScalar(1-finish);}

    floor.position.y=lerp(-4.4,-1.57,phase(p,4.65,5.04));
    const bagReveal=phase(p,4.68,5.04);bag.group.visible=p>4.68;bag.group.scale.setScalar(1.3*bagReveal);bag.group.position.set(.05,lerp(-1.7,.25,bagReveal),0);bag.group.rotation.set(.025,lerp(-1.1,-.22,bagReveal)+Math.sin(time*.32)*.025,-.055*(1-bagReveal));

    const wide=phase(p,.6,1.7);
    let [distance,offset,aimY,orbit]=sampleCamera(p);
    if(mobile){distance*=1.52;offset=0;aimY+=distance*lerp(.16,.095,wide*(1-focus));const rootDive=phase(p,.78,1.02)*(1-phase(p,1.22,1.50));aimY=lerp(aimY,-1.65-distance*.30,rootDive);}
    look.set(-offset,aimY,0);cameraPosition.set(-offset+Math.sin(orbit)*distance+pointerSmooth.x*.10,aimY+.24-pointerSmooth.y*.065,Math.cos(orbit)*distance);
    camera.position.copy(cameraPosition);camera.lookAt(look);camera.updateMatrixWorld();
    surfaceLine.set(0,-1.65,0).project(camera);const surfaceY=(1-surfaceLine.y)*.5;
    const underground=p<2.58?phase(surfaceY,.13,.025):0;
    ink.copy(inkDay).lerp(inkNight,Math.max(night,underground));document.documentElement.style.setProperty('--ink',ink.getStyle());
    document.querySelector('footer').style.color=p<2.58?'#f2e8ce':'';
    focusPoint.set(0,p<.7?seed.position.y:p<1.35?-2.75:p<1.7?-.8:p<2.6?.8:1.15,0);
    if(p>3.2)focusPoint.copy(hero.position);if(p>4.85)focusPoint.copy(bag.group.position);
    dust.rotation.y=time*.012;dust.material.opacity=.2*(1-focus*.4);
    science.update(p,time,seed,hero);
    focusView.copy(focusPoint).applyMatrix4(camera.matrixWorldInverse);cinema.render(time,-focusView.z,night);
    document.body.classList.add('scene-ready');stage.querySelector('.scene-loading')?.remove();
    window.cornStory={surfaceScreenY:surfaceY,progress:p,chapter:Math.floor(p+.22),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderer:'Three.js / WebGL2 + cinematic depth pass',objects:{seed:seed.visible,plant:plant.group.visible,ear:ear.group.visible,kernel:hero.visible,pack:bag.group.visible}};
    frameId=requestAnimationFrame(draw);
  }
  await renderer.compileAsync(scene,camera);
  progress();current=target;draw();
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frameId);if(!document.hidden){lastTime=performance.now();frameId=requestAnimationFrame(draw);}});
} catch(error) {fallback(error);}
