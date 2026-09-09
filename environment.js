import * as T from './vendor/three.module.js';
import {random,phase,makeLeaf} from './models.js';

function detailTexture(kind) {
  const size=512,data=new Uint8Array(size*size*4),rng=random(401);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,vein=Math.cos(x*.77+Math.sin(y*.023)*.45)*.17+Math.cos(x*.21)*.13;
    if(kind==='normal'){const nx=-vein,ny=Math.sin(y*.2+x*.83)*.012,nz=1,n=Math.hypot(nx,ny,nz);data[i]=(nx/n*.5+.5)*255;data[i+1]=(ny/n*.5+.5)*255;data[i+2]=(nz/n*.5+.5)*255;}
    else {const value=kind==='soil'?218+rng()*31:185+vein*32+(rng()-.5)*12;data[i]=data[i+1]=data[i+2]=value;}
    data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

export async function loadSurfaces(renderer) {
  const loader=new T.TextureLoader();
  const [leaf,soil]=await Promise.all([loader.loadAsync('assets/corn-leaf-color.png'),loader.loadAsync('assets/fertile-soil-color.png')]);
  for(const tex of [leaf,soil]){tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
  const leafHeight=leaf.clone();leafHeight.colorSpace=T.NoColorSpace;leafHeight.needsUpdate=true;
  const soilHeight=soil.clone();soilHeight.colorSpace=T.NoColorSpace;soilHeight.needsUpdate=true;
  return {leaf,soil,leafHeight,soilHeight,leafNormal:detailTexture('normal'),leafRoughness:detailTexture('leaf'),soilRoughness:detailTexture('soil')};
}

function mergeMeshGeometry(meshes) {
  const pos=[],normal=[],uv=[],color=[];
  const vertex=new T.Vector3(),n=new T.Vector3(),normalMatrix=new T.Matrix3();
  for(const mesh of meshes){mesh.updateMatrixWorld(true);const g=mesh.geometry.toNonIndexed(),p=g.attributes.position,norm=g.attributes.normal;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);n.fromBufferAttribute(norm,i).applyMatrix3(normalMatrix).normalize();pos.push(vertex.x,vertex.y,vertex.z);normal.push(n.x,n.y,n.z);uv.push(g.attributes.uv?.getX(i)||0,g.attributes.uv?.getY(i)||0);if(g.attributes.color)color.push(g.attributes.color.getX(i),g.attributes.color.getY(i),g.attributes.color.getZ(i));else color.push(.65,.78,.4);}
    g.dispose();
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(color,3));return geometry;
}

export function makeField(textures,mobile) {
  const material=new T.MeshStandardMaterial({map:textures.leaf,vertexColors:true,roughness:.8,side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false});
  const meshes=[];
  const stem=new T.Mesh(new T.CylinderGeometry(.022,.055,4.7,5),material);stem.position.y=2.35;meshes.push(stem);
  for(let i=0;i<8;i++){const leaf=makeLeaf(2.3-i*.12,.23-i*.012,material,i,18,5);leaf.update(1,i);leaf.mesh.position.y=.45+i*.49;leaf.mesh.rotation.y=i%2===0?-1.1:1.9;meshes.push(leaf.mesh);}
  const geo=mergeMeshGeometry(meshes),count=mobile?26:54,field=new T.InstancedMesh(geo,material,count),rng=random(104),o=new T.Object3D();
  for(let i=0;i<count;i++) {
    o.position.set((i%9-4)*2.2+(rng()-.5)*.5,-2.9,-4.5-Math.floor(i/9)*2.4);
    o.rotation.y=(rng()-.5)*1.3;const s=.82+rng()*.42;o.scale.setScalar(s);o.updateMatrix();field.setMatrixAt(i,o.matrix);
    field.setColorAt(i,new T.Color().setHSL(.23+rng()*.045,.32,.52+rng()*.14));
  }
  field.receiveShadow=false;field.castShadow=false;
  return {field,update(p,time){const amount=phase(p,1.55,2.1)*(1-phase(p,2.65,3.0));field.visible=amount>.001;material.opacity=amount*.8;material.depthWrite=amount>.95;field.rotation.z=Math.sin(time*.3)*.004;}};
}

export function makeEarth(textures) {
  const group=new T.Group(),rng=random(432);
  const common={map:textures.soil,bumpMap:textures.soilHeight,bumpScale:.045,roughness:1};
  const backMat=new T.MeshStandardMaterial({...common,color:'#baad91'}),frontMat=backMat.clone();
  function half(start) {
    const geo=new T.CylinderGeometry(1.13,1.06,1.32,64,12,false,start,Math.PI);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),noise=Math.sin(x*26+z*11)*Math.sin(y*20+x*3)*.018;pos.setXYZ(i,x+noise,y+noise*.6,z+noise);}geo.computeVertexNormals();
    return geo;
  }
  const back=new T.Mesh(half(Math.PI/2),backMat);back.position.y=-.66;back.castShadow=true;back.receiveShadow=true;group.add(back);
  const front=new T.Mesh(half(-Math.PI/2),frontMat);front.position.y=-.66;front.castShadow=true;front.receiveShadow=true;group.add(front);
  const face=new T.Mesh(new T.PlaneGeometry(2.18,1.30,24,18),backMat);face.position.set(0,-.66,-.015);group.add(face);
  const pebbleMat=new T.MeshStandardMaterial({...common,color:'#897556'}),pebbles=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),pebbleMat,480),dummy=new T.Object3D();
  for(let i=0;i<480;i++){const a=rng()*Math.PI*2,r=Math.sqrt(rng())*1.12;dummy.position.set(Math.cos(a)*r,.014+rng()*.05,Math.sin(a)*r);const s=.018+rng()*.06;dummy.scale.set(s,s*.65,s);dummy.rotation.set(rng()*5,rng()*5,rng()*5);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);pebbles.setColorAt(i,new T.Color().setHSL(.085,.22,.36+rng()*.24));}pebbles.castShadow=true;pebbles.receiveShadow=true;group.add(pebbles);
  const hairPositions=[],hairEnd=[],birth=[];
  for(let i=0;i<460;i++){const a=rng()*Math.PI*2,d=rng(),r=.05+d*.9;const x=Math.cos(a)*r,y=-d*1.4,z=.06+Math.abs(Math.sin(a))*r*.6;for(let j=0;j<2;j++){hairPositions.push(x,y,z);hairEnd.push(x+(j?(rng()-.5)*.22:0),y-(j?rng()*.17:0),z+(j?rng()*.10:0));birth.push(d*.7+rng()*.2);}}
  const hairGeo=new T.BufferGeometry();hairGeo.setAttribute('position',new T.Float32BufferAttribute(hairPositions,3));hairGeo.setAttribute('aEnd',new T.Float32BufferAttribute(hairEnd,3));hairGeo.setAttribute('aBirth',new T.Float32BufferAttribute(birth,1));
  const uniforms={uGrowth:{value:0},uOpacity:{value:1}};
  const hairMat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    vertexShader:'attribute vec3 aEnd;attribute float aBirth;uniform float uGrowth;void main(){float t=smoothstep(aBirth,aBirth+.15,uGrowth);gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(position,aEnd,t),1.0);}',
    fragmentShader:'uniform float uOpacity;void main(){gl_FragColor=vec4(.64,.52,.32,uOpacity*.65);}'});
  const hair=new T.LineSegments(hairGeo,hairMat);group.add(hair);
  function update(p){const cut=phase(p,.69,1.16),fade=1-phase(p,2.58,3.0);group.visible=p<3.0;front.position.set(0,-.66-cut*.6,cut*.9);frontMat.transparent=true;frontMat.opacity=(1-cut)*fade;front.visible=cut<.999;backMat.transparent=fade<1;backMat.opacity=fade;pebbleMat.transparent=true;pebbleMat.opacity=(1-cut*.72)*fade;uniforms.uGrowth.value=phase(p,.87,1.57);uniforms.uOpacity.value=fade;hair.visible=p>.87;}
  return {group,update};
}
