import * as T from './vendor/three.module.js';
import {phase,lerp,clamp,random,makeLeaf,growingTube} from './models.js';

// Root tips advance along continuous curves. Children are attached to a point on
// their actual parent and cannot grow until that point has been reached.
export function createRoot(points,radius,material,rings=36) {
  const curve=new T.CatmullRomCurve3(points),sides=6,pos=new Float32Array((rings+1)*(sides+1)*3),normal=new Float32Array(pos.length),ix=[];
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i;ix.push(a,a+1,a+sides+1,a+1,a+sides+2,a+sides+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setIndex(ix);
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.castShadow=radius>.01;
  const point=new T.Vector3(),tangent=new T.Vector3(),side=new T.Vector3(),up=new T.Vector3(),axis=new T.Vector3(0,0,1);let last=-1;
  function update(g){mesh.visible=g>.0001;if(!mesh.visible){last=0;return;}if(Math.abs(g-last)<.00002)return;last=g;
    for(let j=0;j<=rings;j++){const t=j/rings,u=t*g;curve.getPointAt(u,point);curve.getTangentAt(u,tangent);side.crossVectors(tangent,axis).normalize();up.crossVectors(side,tangent).normalize();const r=radius*(.11+.89*Math.pow(1-u,.7))*(.04+.96*phase(1-t,0,.12))*Math.min(1,g*9);
      for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,nx=side.x*Math.cos(a)+up.x*Math.sin(a),ny=side.y*Math.cos(a)+up.y*Math.sin(a),nz=side.z*Math.cos(a)+up.z*Math.sin(a),k=(j*(sides+1)+i)*3;pos[k]=point.x+nx*r;pos[k+1]=point.y+ny*r;pos[k+2]=point.z+nz*r;normal[k]=nx;normal[k+1]=ny;normal[k+2]=nz;}
    }geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
  }
  update(.001);return {mesh,curve,update,get growth(){return last;}};
}

export function makeRootNetwork() {
  const group=new T.Group(),mat=new T.MeshStandardMaterial({color:'#ead9ad',roughness:.83}),rng=random(205),roots=[];
  const hairStart=[],hairEnd=[],hairBirth=[];
  const inverseEase=t=>{let a=0,b=1;for(let i=0;i<24;i++){const m=(a+b)/2;if(phase(m,0,1)<t)a=m;else b=m;}return (a+b)/2;};
  for(let i=0;i<13;i++){
    const a=i*2.39996,spread=i===0?.13:.3+rng()*1.2,depth=i===0?2.05:.75+rng()*1.05;
    const x=Math.cos(a)*spread,z=.16+Math.abs(Math.sin(a))*spread*.38;
    const pts=[new T.Vector3(Math.sin(a)*.035,-.015,.12),new T.Vector3(x*.18,-.14,.16),new T.Vector3(x*.43+(rng()-.5)*.11,-depth*.37,z*.72),new T.Vector3(x*.66+(rng()-.5)*.17,-depth*.65,z+.025),new T.Vector3(x*.88,-depth*.84,z-.03),new T.Vector3(x,-depth,z+.04)];
    const root=createRoot(pts,i===0?.029:.015+rng()*.010,mat,46);group.add(root.mesh);
    const birth=.67+i*.024,duration=.66+i*.009;roots.push({root,birth,duration});
    for(let b=0;b<6;b++){
      const attach=.15+b*.12,anchor=root.curve.getPointAt(attach),direction=(b%2?1:-1),length=.15+rng()*.37;
      const end=anchor.clone().add(new T.Vector3(direction*length,-length*(.6+rng()),.04+rng()*.10));
      const child=createRoot([anchor,anchor.clone().lerp(end,.38).add(new T.Vector3(direction*.04,0,0)),end],.0065*(1-attach*.4),mat,24);group.add(child.mesh);
      const childBirth=birth+duration*inverseEase(attach);roots.push({root:child,birth:childBirth,duration:.3,parent:root,attach});
      for(let twig=0;twig<2;twig++){
        const u=.32+twig*.33,base=child.curve.getPointAt(u),tip=base.clone().add(new T.Vector3((rng()-.5)*.25,-.10-rng()*.15,.02+rng()*.06));
        const tertiary=createRoot([base,base.clone().lerp(tip,.45).add(new T.Vector3(.025,0,0)),tip],.0026,mat,16);group.add(tertiary.mesh);
        roots.push({root:tertiary,birth:childBirth+.3*inverseEase(u),duration:.22,parent:child,attach:u});
      }
      for(let h=0;h<15;h++){
        const u=.12+rng()*.8,start=child.curve.getPointAt(u),tip=start.clone().add(new T.Vector3((rng()-.5)*.1,-.025-rng()*.05,(rng()-.5)*.035));
        for(let v=0;v<2;v++){hairStart.push(start.x,start.y,start.z);hairEnd.push(v?tip.x:start.x,v?tip.y:start.y,v?tip.z:start.z);hairBirth.push(childBirth+.3*inverseEase(u)+.015);}
      }
    }
  }
  const hg=new T.BufferGeometry();hg.setAttribute('position',new T.Float32BufferAttribute(hairStart,3));hg.setAttribute('aEnd',new T.Float32BufferAttribute(hairEnd,3));hg.setAttribute('aBirth',new T.Float32BufferAttribute(hairBirth,1));
  const uniforms={uProgress:{value:0},uFade:{value:1}},hm=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    vertexShader:'attribute vec3 aEnd;attribute float aBirth;uniform float uProgress;varying float vGrowth;void main(){vGrowth=smoothstep(aBirth,aBirth+.17,uProgress);gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(position,aEnd,vGrowth),1.0);}',
    fragmentShader:'uniform float uFade;varying float vGrowth;void main(){gl_FragColor=vec4(.63,.51,.32,uFade*vGrowth*.58);}'});
  const hairs=new T.LineSegments(hg,hm);hairs.frustumCulled=false;group.add(hairs);
  function update(p,fade){for(const item of roots){const ready=!item.parent||item.parent.growth>=item.attach;item.root.update(ready?phase(p,item.birth,item.birth+item.duration):0);}uniforms.uProgress.value=p;uniforms.uFade.value=fade;mat.transparent=fade<1;mat.opacity=fade;group.visible=p>.64&&fade>.001;}
  return {group,update,roots};
}

export function makePlant(textures) {
  const group=new T.Group(),roots=makeRootNetwork();group.add(roots.group);
  const stemMat=new T.MeshStandardMaterial({color:'#c1d58a',map:textures.leaf,bumpMap:textures.leafHeight,bumpScale:.006,roughness:.53});
  const leafMat=new T.MeshPhysicalMaterial({map:textures.leaf,normalMap:textures.leafNormal,normalScale:new T.Vector2(.34,.34),roughnessMap:textures.leafRoughness,roughness:.68,vertexColors:true,side:T.DoubleSide,clearcoat:.16,clearcoatRoughness:.55,transmission:.018,thickness:.018,ior:1.35});
  const sheathMat=new T.MeshStandardMaterial({map:textures.leaf,color:'#c5d594',normalMap:textures.leafNormal,normalScale:new T.Vector2(.22,.22),roughness:.57,side:T.DoubleSide});
  const lengths=[.12,.17,.23,.30,.36,.42,.47,.50,.50,.47,.43,.39,.33,.25],nodeHeights=new Array(15).fill(0),segments=[],leaves=[],collars=[],sheaths=[];
  for(let i=0;i<14;i++){
    const radius=lerp(.078,.021,i/13),geo=new T.CylinderGeometry(radius*.9,radius,1,14,4),stem=new T.Mesh(geo,stemMat);stem.castShadow=true;group.add(stem);segments.push(stem);
    const collar=new T.Mesh(new T.TorusGeometry(radius*1.01,.009*(1-i/20),5,18),stemMat);collar.rotation.x=Math.PI/2;group.add(collar);collars.push(collar);
    const middle=Math.sin(Math.PI*(i+.5)/15),length=(.65+middle*2.03)*(1+Math.sin(i*7.4)*.07),width=.095+middle*.255;
    const leaf=makeLeaf(length,width,leafMat,i*1.71,72,18,{angle:lerp(.99,.20,i/13),droop:lerp(1.04,.35,i/13),twist:Math.sin(i*4.1)*.62,wave:.07+middle*.03});
    leaf.mesh.rotation.y=(i%2===0?-1.20:1.92)+Math.sin(i*2.5)*.27;group.add(leaf.mesh);leaves.push(leaf);
    const sheath=new T.Mesh(new T.CylinderGeometry(radius*1.23,radius*1.08,1,24,8,true,leaf.mesh.rotation.y+.28,Math.PI*1.72),sheathMat);sheath.castShadow=true;group.add(sheath);sheaths.push(sheath);
  }
  const tassel=new T.Group(),gold=new T.MeshStandardMaterial({color:'#b8a777',roughness:.9});group.add(tassel);
  const branches=[];for(let i=0;i<17;i++){const a=i*2.4,h=.25+(i%5)*.08,reach=.10+(i%4)*.075;
    const branch=growingTube([[0,0,0],[Math.sin(a)*reach*.45,h*.7,Math.cos(a)*reach*.45],[Math.sin(a)*reach,h,Math.cos(a)*reach]],.009,gold,16);branch.update(1);tassel.add(branch.mesh);branches.push(branch);
    for(let j=1;j<8;j++){const floret=new T.Mesh(new T.SphereGeometry(.018,5,4),gold);floret.position.set(Math.sin(a)*reach*j/8,h*j/8,Math.cos(a)*reach*j/8);floret.scale.set(.6,2,.6);tassel.add(floret);}
  }
  const shank=new T.Mesh(new T.CylinderGeometry(.035,.055,1,10),stemMat);group.add(shank);const shankEnd=new T.Vector3(.16,0,.25),upAxis=new T.Vector3(0,1,0);shank.quaternion.setFromUnitVectors(upAxis,shankEnd.clone().normalize());
  let lastGrowth=-1;
  function update(p,time){const fade=1-phase(p,2.74,3.2);group.visible=p>.64&&p<3.2;if(!group.visible)return;roots.update(p,fade);
    nodeHeights[0]=0;
    for(let i=0;i<14;i++){
      const birth=1.0+i*.058,g=phase(p,birth,birth+.53),length=lengths[i]*g;
      nodeHeights[i+1]=nodeHeights[i]+length;
      const lean=Math.sin(i*.25)*.022*phase(p,1.6,2.4);
      segments[i].position.set(lean,nodeHeights[i]+length*.5,0);segments[i].scale.set(.65+.35*g,Math.max(.00001,length),.65+.35*g);segments[i].visible=g>.001;
      collars[i].position.set(lean,nodeHeights[i+1],0);collars[i].scale.setScalar(g);collars[i].visible=g>.005;
      sheaths[i].position.set(lean,nodeHeights[i]+length*.52,0);sheaths[i].scale.set(.7+.3*g,Math.max(.0001,length*1.04),.7+.3*g);sheaths[i].visible=g>.005;
      const lg=phase(p,birth+.09,birth+.72),leaf=leaves[i];leaf.mesh.position.set(lean,nodeHeights[i+1],0);leaf.mesh.visible=lg>.001;leaf.update(lg,time*.6);leaf.mesh.rotation.z=Math.sin(time*.6+i*.4)*.011*lg;
    }
    const earGrowth=phase(p,1.95,2.45);shank.position.set(.08,nodeHeights[7],.125);shank.scale.set(earGrowth,.297*earGrowth,earGrowth);shank.visible=earGrowth>.001;
    tassel.position.y=nodeHeights[14];tassel.scale.setScalar(phase(p,2.05,2.47));
    for(const mat of [stemMat,leafMat,sheathMat,gold]){mat.transparent=fade<1;mat.opacity=fade;mat.depthWrite=fade>.5;}
    lastGrowth=p;
  }
  return {group,update,roots,nodeHeights,leaves,sheaths};
}
