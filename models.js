import * as T from './vendor/three.module.js';
import {makeSilk} from './silk.js';

export const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b,v));
export const lerp = (a,b,t) => a+(b-a)*t;
export function phase(p,a,b) { const t=clamp((p-a)/(b-a)); return t*t*t*(t*(t*6-15)+10); }
export function random(seed=19) { return () => {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}; }
const V=(x,y,z)=>new T.Vector3(x,y,z);

// A tapered, rounded dent-corn kernel with a broad crown and a narrow hilum.
// Shared by the seed, every kernel on the ear, and the close-up hero.
export function kernelGeometry(detail=72) {
  const geo=new T.SphereGeometry(1,detail,Math.floor(detail*.75));
  const pos=geo.attributes.position, colors=[];
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),t=(y+1)*.5;
    const square=v=>Math.sign(v)*Math.pow(Math.abs(v),.74);
    const width=.48*(.42+.58*Math.pow(t,.52));
    const dent=.048*Math.exp(-(x*x+z*z)*18)*phase(t,.78,1);
    const skin=.0024*Math.sin(Math.atan2(z,x)*23+t*8)*Math.sin(t*Math.PI);
    const embryo=Math.exp(-x*x*55-Math.pow(t-.28,2)*22)*Math.max(0,z);
    pos.setXYZ(i,square(x)*width+.021*Math.sin(t*Math.PI),y*.56-dent,(square(z)*(.24+.10*t)+.022*Math.sin(t*Math.PI)+skin)-embryo*.025);
    const color=new T.Color('#c9860c').lerp(new T.Color('#f2c748'),.2+t*.8);
    color.lerp(new T.Color('#e9ca79'),embryo*.52);
    if(t<.14)color.lerp(new T.Color('#dcc99b'),(1-t/.14)*.85);
    colors.push(color.r,color.g,color.b);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}

export function grainTexture() {
  const size=512,data=new Uint8Array(size*size*4),rng=random(72);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {const i=(y*size+x)*4;const v=128+Math.sin(x*.39+Math.sin(y*.019)*2)*9+Math.sin(x*1.5+y*.16)*3+(rng()-.5)*28;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
  const texture=new T.DataTexture(data,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

export function makeLeaf(length,width,material,seed=0,rows=54,cols=14,options={}) {
  const positions=new Float32Array((rows+1)*(cols+1)*3),colors=[],indices=[],uv=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++) {
    const s=j/cols*2-1;
    const vein=Math.exp(-s*s*90)*.22+Math.cos(j*3.6)*.025;
    const color=new T.Color('#d8e3bf').lerp(new T.Color('#fff5bd'),vein+.13*i/rows);
    colors.push(color.r,color.g,color.b);
    uv.push(.16+j/cols*.68,.05+i/rows*.90);
    if(i<rows&&j<cols){let a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
  const mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  function update(growth,time=0,peel=0) {
    const g=Math.max(.001,growth),unfold=phase(g,.18,.92),angle=options.angle??.75,droop=options.droop??.83,twist=options.twist??Math.sin(seed)*.14;
    for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++) {
      const t=i/rows,s=j/cols*2-1,idx=(i*(cols+1)+j)*3;
      const profile=Math.pow(Math.sin(Math.PI*t),.77)*(1-.25*t);
      const spread=width*profile*(.07+.93*unfold)*g;
      const forward=length*g*(lerp(.055,Math.sin(angle),unfold)*t+unfold*.24*t*t);
      const rise=length*g*(lerp(1,Math.cos(angle),unfold)*t-(droop*unfold+peel*.42)*t*t*.79);
      const curl=(1-unfold)*Math.PI*.85;
      const lateral=lerp(s,Math.sin(s*Math.PI*.8)*.43,1-unfold)*spread;
      const ridge=(1-Math.abs(s))*spread*.20;
      const edgeWave=(Math.sin(t*15+seed)*.022+Math.sin(t*34+seed)*.006)*Math.pow(Math.abs(s),2.5)*Math.sin(Math.PI*t)*g;
      const wind=Math.sin(time+t*3.2+seed*.21)*.028*t*t*g;
      const rotation=(twist*t*t+Math.sin(t*8+seed)*(options.wave??.025)*t)*unfold;
      const folded=ridge+(1-Math.cos(s*curl))*spread*.9;
      positions[idx]=lateral*Math.cos(rotation)-folded*Math.sin(rotation)+Math.sin(t*4+seed)*.022*t*g;
      positions[idx+1]=rise+folded*Math.cos(rotation)+lateral*Math.sin(rotation)+edgeWave+wind+Math.sin(t*9+seed)*(options.wave??.015)*Math.sin(Math.PI*t)*unfold*g;
      positions[idx+2]=forward+Math.sin(seed+t*5)*.025*t*t*g;
    }
    geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();
  }
  update(.001);return {mesh,update};
}

export function growingTube(points,radius,material,segments=40) {
  const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)));
  const geometry=new T.TubeGeometry(curve,segments,radius,5,false);
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const t=Math.floor(i/6)/segments,c=curve.getPointAt(clamp(t)),factor=.08+.92*Math.pow(1-clamp(t),.65);pos.setXYZ(i,c.x+(pos.getX(i)-c.x)*factor,c.y+(pos.getY(i)-c.y)*factor,c.z+(pos.getZ(i)-c.z)*factor);}geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;
  return {mesh,update(g){geometry.setDrawRange(0,Math.floor(clamp(g)*segments)*5*6);mesh.visible=g>.001;}};
}

export function makePlant(textures={}) {
  const group=new T.Group(),roots=new T.Group();group.add(roots);
  const green=new T.MeshStandardMaterial({color:'#839d50',roughness:.64,map:textures.leaf,bumpMap:textures.leafHeight,bumpScale:.015});
  const leafMat=new T.MeshPhysicalMaterial({vertexColors:true,map:textures.leaf,bumpMap:textures.leafHeight,bumpScale:.018,side:T.DoubleSide,roughness:.49,metalness:0,clearcoat:.16,clearcoatRoughness:.65,transmission:.025,thickness:.03,ior:1.36});
  const rootMat=new T.MeshStandardMaterial({color:'#dfc99b',roughness:.82});
  const stem=new T.Mesh(new T.CylinderGeometry(.035,.09,5.1,12,22),green);stem.castShadow=true;group.add(stem);
  const leaves=[];
  for(let i=0;i<11;i++) {
    const leaf=makeLeaf(lerp(2.45,1.2,i/10),lerp(.27,.13,i/10),leafMat,i*2.8);
    leaf.mesh.rotation.y=i%2===0?-1.05:1.9;
    leaf.mesh.rotation.y+=Math.sin(i*3.7)*.3;
    group.add(leaf.mesh);leaves.push(leaf);
  }
  const rng=random(12),rootCurves=[];
  for(let i=0;i<15;i++) {
    const angle=i*2.4,reach=.65+rng()*.75,depth=.6+rng()*.9;
    const end=[Math.cos(angle)*reach,-depth,Math.sin(angle)*reach*.6];
    const root=growingTube([[0,0,0],[end[0]*.2,-.2,end[2]*.2],[end[0]*.6,-depth*.63,end[2]*.8],end],.014+rng()*.012,rootMat,30);
    roots.add(root.mesh);rootCurves.push({root,delay:i*.018});
    for(let j=1;j<4;j++) {
      const t=j/4,start=[end[0]*t,-depth*t,end[2]*t];
      const child=growingTube([start,[start[0]+.14*Math.sin(i+j),start[1]-.15,start[2]+.12],[start[0]+.24*Math.sin(i+j),start[1]-.35,start[2]+.2]],.006,rootMat,15);
      roots.add(child.mesh);rootCurves.push({root:child,delay:.17+j*.08});
    }
  }
  const tassel=new T.Group();group.add(tassel);
  const tasselMat=new T.MeshStandardMaterial({color:'#bba65e',roughness:.8});
  for(let i=0;i<13;i++) {
    const a=i*2.4,h=.25+(i%4)*.1;
    const branch=growingTube([[0,0,0],[Math.sin(a)*.18,h*.5,Math.cos(a)*.18],[Math.sin(a)*.32,h,Math.cos(a)*.32]],.009,tasselMat,12);branch.update(1);tassel.add(branch.mesh);
    for(let j=0;j<6;j++){const floret=new T.Mesh(new T.SphereGeometry(.024,5,4),tasselMat);floret.scale.set(.65,2.2,.7);floret.position.set(Math.sin(a)*.32*j/6,h*j/6,Math.cos(a)*.32*j/6);tassel.add(floret);}
  }
  const materials=[green,leafMat,rootMat,tasselMat];
  function update(p,time) {
    const g=phase(p,.92,2.18),fade=1-phase(p,2.7,3.2);
    group.visible=p>.65&&p<3.25;
    if(!group.visible)return;
    stem.scale.set(.4+.6*g,Math.max(.001,g),.4+.6*g);stem.position.y=5.1*g/2;
    leaves.forEach((leaf,i)=>{const lg=phase(p,1.02+i*.065,1.55+i*.064);leaf.mesh.position.y=(.5+i*.39)*g;leaf.update(lg,time*.65);leaf.mesh.rotation.z=Math.sin(i*3+time*.5)*.025*lg;leaf.mesh.visible=lg>.002;});
    rootCurves.forEach(({root,delay})=>root.update(phase(p,.7+delay,1.25+delay)));
    const tg=phase(p,1.96,2.3);tassel.scale.setScalar(tg);tassel.position.y=5.1*g;
    for(const mat of materials){mat.transparent=fade<1;mat.opacity=fade;mat.depthWrite=fade>.5;}
  }
  return {group,update};
}

export function makeSoil() {
  const group=new T.Group(),rng=random(42),mat=new T.MeshStandardMaterial({color:'#655039',roughness:1});
  const geo=new T.IcosahedronGeometry(1,1),rock=new T.InstancedMesh(geo,mat,240),o=new T.Object3D();
  for(let i=0;i<240;i++) {
    const a=rng()*Math.PI*2,r=Math.sqrt(rng())*1.24;
    o.position.set(Math.cos(a)*r,-.05-rng()*.36,Math.sin(a)*r*.65);
    const s=.055+rng()*.13;o.scale.set(s,s*.68,s);o.rotation.set(rng()*5,rng()*5,rng()*5);o.updateMatrix();rock.setMatrixAt(i,o.matrix);
    rock.setColorAt(i,new T.Color().setHSL(.09,.22,.14+rng()*.12));
  }
  rock.castShadow=true;rock.receiveShadow=true;group.add(rock);
  return {group,update(p){const fade=1-phase(p,2.55,3.12);group.visible=p<3.12;mat.transparent=true;mat.opacity=fade*(1-phase(p,.75,1.3)*.74);mat.depthWrite=p<.8;}};
}

export function makeEar(kernelGeo,kernelMat,textures={}) {
  const group=new T.Group(),count=14*22-1,instanced=new T.InstancedMesh(kernelGeo,kernelMat,count);
  instanced.instanceMatrix.setUsage(T.DynamicDrawUsage);instanced.castShadow=true;instanced.receiveShadow=true;instanced.frustumCulled=false;group.add(instanced);
  const dummy=new T.Object3D(),entries=[],rng=random(96);let idx=0;
  for(let row=0;row<22;row++)for(let col=0;col<14;col++) {
    const angle=col/14*Math.PI*2,r=.245*Math.pow(Math.sin((row/24+.08)*Math.PI),.25);
    const e={position:V(Math.sin(angle)*r,row*.083,Math.cos(angle)*r),angle,row,col,scale:V(.115,.075,.125),spin:rng()*6.28};
    if(row===11&&col===0)continue;
    entries.push(e);instanced.setColorAt(idx++,new T.Color('#ffffff').lerp(new T.Color('#d3a963'),rng()*.24));
  }
  const coreMat=new T.MeshStandardMaterial({color:'#e7c974',roughness:.6});
  const core=new T.Mesh(new T.CylinderGeometry(.08,.19,1.88,20),coreMat);core.position.y=.85;group.add(core);
  const huskMat=new T.MeshPhysicalMaterial({color:'#c0c77f',map:textures.leaf,bumpMap:textures.leafHeight,bumpScale:.025,roughness:.56,side:T.DoubleSide,clearcoat:.13});
  const husks=[];
  for(let i=0;i<6;i++){
    const rows=48,cols=14,pos=new Float32Array((rows+1)*(cols+1)*3),uv=[],ix=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){uv.push(x/cols,y/rows);if(y<rows&&x<cols){const a=y*(cols+1)+x;ix.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);
    const mesh=new T.Mesh(geo,huskMat);mesh.rotation.y=i/6*Math.PI*2;mesh.position.y=-.12;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);
    husks.push({mesh,update(peel){for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const t=y/rows,s=x/cols*2-1,k=(y*(cols+1)+x)*3;const profile=Math.pow(Math.sin(Math.PI*t),.65),r=(.245+.10*profile)*(1-phase(t,.79,1)*.93)*(1+i*.012);pos[k]=Math.sin(s*.9)*r*(1-t*.45)*(1+peel*.55);pos[k+1]=(2.09+(i%3)*.035)*t-peel*1.6*t*t+Math.abs(s)*.045*profile;pos[k+2]=Math.cos(s*.9)*r+peel*1.3*t*t+Math.sin(t*24+i)*.007*Math.abs(s);}geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();}});
  }
  const silk=makeSilk();silk.position.y=2.01;group.add(silk);
  const selectedLocal=V(0,11*.083,.245*Math.pow(Math.sin((11/24+.08)*Math.PI),.25));
  function update(p) {
    const grow=phase(p,1.95,2.45),peel=phase(p,2.35,2.85),burst=phase(p,2.94,3.55),fade=1-phase(p,3.2,3.7);
    group.visible=p>1.95&&p<3.7;group.scale.setScalar(Math.max(.001,grow));
    entries.forEach((e,i)=>{dummy.position.copy(e.position);const spread=burst*(1+(e.row%5)*.15);dummy.position.x+=Math.sin(e.angle)*spread*3;dummy.position.z+=Math.cos(e.angle)*spread*2.5;dummy.position.y+=(e.row-11)*spread*.16;dummy.rotation.set(burst*e.spin,e.angle+burst*2,burst*Math.sin(i)*2);dummy.scale.copy(e.scale).multiplyScalar(Math.max(.001,fade));dummy.updateMatrix();instanced.setMatrixAt(i,dummy.matrix);});instanced.instanceMatrix.needsUpdate=true;
    husks.forEach((h,i)=>{h.update(peel);h.mesh.scale.setScalar(1-phase(p,2.93,3.2));});
    core.scale.setScalar(1-phase(p,2.95,3.32));silk.scale.setScalar(1-phase(p,2.75,3.12));
  }
  return {group,update,selectedLocal};
}

// Sewn, inflated sack: two curved surfaces and gusseted sides, not a billboard.
export function bagGeometry() {
  const rings=48,segments=64,pos=[],uv=[],indices=[];
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++) {
    const t=j/rings,a=i/segments*Math.PI*2;
    const fullness=Math.pow(Math.sin(t*Math.PI),.24);
    const width=.76*(.87+.13*fullness),depth=.27*(.13+.87*fullness);
    const c=Math.cos(a),s=Math.sin(a),superellipse=v=>Math.sign(v)*Math.pow(Math.abs(v),.42);
    const wrinkle=Math.sin(t*64+a*7)*.006*(.3+.7*Math.pow(Math.abs(t-.5)*2,4));
    pos.push(superellipse(c)*width+wrinkle,(t-.5)*2.5,superellipse(s)*depth+wrinkle);
    uv.push(1-i/segments,t);
    if(j<rings&&i<segments){const k=j*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function makeBag() {
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1536;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f9f8ed';ctx.fillRect(0,0,2048,1536);
  // UV front occupies the first half of the circumference. Labels stay crisp as the sack turns.
  for(const center of [512,1536]) {
    ctx.fillStyle='#175d34';ctx.fillRect(center-510,940,1020,360);
    ctx.textAlign='center';ctx.fillStyle='#175d34';ctx.font='bold 132px Arial';ctx.fillText('PIONEER',center,490);
    ctx.font='36px Arial';ctx.fillText('C O R N   S E E D',center,580);
    ctx.fillStyle='#dcb83a';ctx.fillRect(center-230,652,460,8);
    ctx.fillStyle='#ffffff';ctx.font='bold 90px Arial';ctx.fillText('POSSIBILITY',center,1090);ctx.font='38px Arial';ctx.fillText('STARTS HERE',center,1160);
    ctx.fillStyle='#48643d';ctx.font='24px Arial';ctx.fillText('PIONEER  /  CORN SEED',center,1415);
    ctx.strokeStyle='#d2d0bd';ctx.lineWidth=3;for(let y of [40,60,1480,1500]){ctx.beginPath();ctx.moveTo(center-500,y);ctx.lineTo(center+500,y);ctx.stroke();}
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const weave=grainTexture();weave.repeat.set(14,18);const material=new T.MeshStandardMaterial({map:texture,color:'#ffffff',roughness:.72,bumpMap:weave,bumpScale:.012,side:T.DoubleSide});
  const group=new T.Group(),body=new T.Mesh(bagGeometry(),material);body.castShadow=true;body.receiveShadow=true;group.add(body);
  const seamMaterial=new T.MeshStandardMaterial({color:'#e7e6d8',roughness:.8});
  for(const y of [-1.24,1.24]) {const seam=new T.Mesh(new T.BoxGeometry(1.34,.032,.058),seamMaterial);seam.position.y=y;group.add(seam);}
  group.rotation.y=-.22;return {group};
}
