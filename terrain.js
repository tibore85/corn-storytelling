import * as T from './vendor/three.module.js';
import {phase,random} from './models.js';

export function makeEarth(textures) {
  const group=new T.Group(),rng=random(78);
  const soilColor=textures.soil.clone(),soilBump=textures.soilHeight.clone();
  soilColor.repeat.set(25,8);soilBump.repeat.copy(soilColor.repeat);soilColor.needsUpdate=soilBump.needsUpdate=true;
  const material=new T.MeshStandardMaterial({map:soilColor,bumpMap:soilBump,bumpScale:.030,roughnessMap:textures.soilRoughness,roughness:.97,vertexColors:true});
  const width=90,depth=24,cols=200,rows=64,geo=new T.PlaneGeometry(width,depth,cols,rows),pos=geo.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),y=pos.getY(i)-depth/2,d=-y;
    const layer=Math.sin(d*3.2+Math.sin(x*.25)*.8)*.035;
    const color=new T.Color('#c7b89f').lerp(new T.Color('#74614c'),phase(d,0,7));color.multiplyScalar(.94+layer);
    colors.push(color.r,color.g,color.b);
    const rough=Math.sin(x*7.9+y*13)*Math.sin(y*8.3-x*6.3)*.021;
    pos.setXYZ(i,x,y,rough-.07);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const face=new T.Mesh(geo,material);face.receiveShadow=true;group.add(face);

  const topMap=textures.soil.clone(),topHeight=textures.soilHeight.clone();topMap.repeat.set(25,24);topHeight.repeat.copy(topMap.repeat);topMap.needsUpdate=topHeight.needsUpdate=true;
  const topMaterial=new T.MeshStandardMaterial({map:topMap,bumpMap:topHeight,bumpScale:.026,color:'#a79981',roughness:.94});
  const surfaceGeometry=new T.PlaneGeometry(width,85,180,80);surfaceGeometry.rotateX(-Math.PI/2);surfaceGeometry.translate(0,0,-42.5);
  const sp=surfaceGeometry.attributes.position;
  for(let i=0;i<sp.count;i++){const x=sp.getX(i),z=sp.getZ(i),distance=Math.min(1,Math.abs(z)*.1);sp.setY(i,(Math.sin(x*.58+z*.3)*.13+Math.sin(x*1.4-z*.8)*.028)*distance);}surfaceGeometry.computeVertexNormals();
  const surface=new T.Mesh(surfaceGeometry,topMaterial);surface.receiveShadow=true;group.add(surface);

  const particleMaterial=new T.MeshStandardMaterial({map:textures.soil,bumpMap:textures.soilHeight,bumpScale:.009,color:'#c0ae92',roughness:1});
  const clods=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),particleMaterial,1200),o=new T.Object3D();
  for(let i=0;i<1200;i++){
    const x=(rng()-.5)*65,z=-(rng()**2)*6.5,s=.018+rng()*.087;
    o.position.set(x,s*.35,z);o.scale.set(s,s*.68,s*.9);o.rotation.set(rng()*6,rng()*6,rng()*6);o.updateMatrix();clods.setMatrixAt(i,o.matrix);clods.setColorAt(i,new T.Color().setHSL(.07,.21,.45+rng()*.28));
  }clods.receiveShadow=true;group.add(clods);

  // Fine roots and fibres belong to the plant. The terrain stays continuous
  // across the whole viewport and remains a cutaway behind the growing roots.
  function update(p){const fade=1-phase(p,2.57,3.0);group.visible=fade>.001;for(const mat of [material,topMaterial,particleMaterial]){mat.transparent=fade<1;mat.opacity=fade;mat.depthWrite=fade>.5;}}
  return {group,update,width,depth};
}
