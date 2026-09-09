import * as T from './vendor/three.module.js';

// Fine strands fall over the tip of the husk, with pale bases and darker ends.
// Merged into one mesh so the extra detail adds a single draw call.
export function makeSilk() {
  const position=[],normal=[],color=[];
  for(let i=0;i<76;i++){
    const a=i*2.39996,spread=.035+(i%7)*.012,length=.43+(i%11)*.047;
    const x=Math.sin(a)*spread,z=Math.cos(a)*spread;
    const curve=new T.CatmullRomCurve3([
      new T.Vector3(x,0,z),new T.Vector3(x*1.2,.14+(i%4)*.014,z+.04),
      new T.Vector3(x*1.9,.075,z+.20),new T.Vector3(x*2.4+.025*Math.sin(i),-length*.46,z+.30),
      new T.Vector3(x*2.2+.043*Math.cos(i),-length,z+.29+.055*Math.sin(i))
    ]);
    const tube=new T.TubeGeometry(curve,30,.0024+(i%3)*.0005,4,false);
    const coords=tube.attributes.position;
    for(let j=0;j<coords.count;j++){const t=Math.floor(j/5)/30,c=curve.getPointAt(Math.min(1,t)),taper=.10+.90*Math.pow(1-t,.55);coords.setXYZ(j,c.x+(coords.getX(j)-c.x)*taper,c.y+(coords.getY(j)-c.y)*taper,c.z+(coords.getZ(j)-c.z)*taper);}
    tube.computeVertexNormals();const geo=tube.toNonIndexed();
    for(let j=0;j<geo.attributes.position.count;j++){
      position.push(geo.attributes.position.getX(j),geo.attributes.position.getY(j),geo.attributes.position.getZ(j));normal.push(geo.attributes.normal.getX(j),geo.attributes.normal.getY(j),geo.attributes.normal.getZ(j));
      const t=geo.attributes.uv.getX(j),c=new T.Color('#bba266').lerp(new T.Color('#442719'),Math.min(1,t*1.3));color.push(c.r,c.g,c.b);
    }tube.dispose();geo.dispose();
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setAttribute('color',new T.Float32BufferAttribute(color,3));
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.77}));mesh.castShadow=true;
  const group=new T.Group();group.add(mesh);return group;
}
