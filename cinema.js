import * as T from './vendor/three.module.js';
import {phase,lerp,random} from './models.js';

export class Cinema {
  constructor(renderer,scene,camera) {
    this.renderer=renderer;this.scene=scene;this.camera=camera;
    this.target=new T.WebGLRenderTarget(1,1,{type:renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
    this.target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
    this.uniforms={tColor:{value:this.target.texture},tDepth:{value:this.target.depthTexture},uResolution:{value:new T.Vector2()},uNear:{value:camera.near},uFar:{value:camera.far},uFocus:{value:10},uAperture:{value:1},uTime:{value:0},uExposure:{value:1.04},uNight:{value:0}};
    const material=new T.ShaderMaterial({uniforms:this.uniforms,depthTest:false,depthWrite:false,toneMapped:false,
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`
        precision highp float;
        uniform sampler2D tColor,tDepth;
        uniform vec2 uResolution;
        uniform float uNear,uFar,uFocus,uAperture,uTime,uExposure,uNight;
        varying vec2 vUv;
        float depthAt(vec2 uv){float d=texture2D(tDepth,uv).x;return uNear*uFar/(uFar-d*(uFar-uNear));}
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        vec3 film(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}
        void main(){
          vec2 texel=1.0/uResolution;
          float depth=depthAt(vUv);
          float coc=clamp(abs(depth-uFocus)/max(depth,.1)*uAperture,0.0,1.0);
          float radius=coc*4.0;
          vec3 original=texture2D(tColor,vUv).rgb;
          vec3 col=original*2.0,bloom=max(original-1.1,0.0);float weight=2.0;
          for(int i=0;i<16;i++){
            float f=float(i),a=f*2.399963;
            vec2 offset=vec2(cos(a),sin(a))*sqrt((f+.5)/16.0)*radius*texel;
            vec2 sampleUv=clamp(vUv+offset,texel,vec2(1.0)-texel);
            float sd=depthAt(sampleUv);
            float w=sd<depth-.35?.15:1.0;
            vec3 s=texture2D(tColor,sampleUv).rgb;
            col+=s*w;weight+=w;
            bloom+=max(texture2D(tColor,vUv+offset*2.8).rgb-1.1,0.0)*.0625;
          }
          col=col/weight+bloom*mix(.035,.12,uNight);
          vec2 edge=vUv-.5;
          col*=1.0-dot(edge,edge)*mix(.12,.38,uNight);
          col=film(col*uExposure);
          col=pow(col,vec3(1.0/2.2));
          col+=(hash(gl_FragCoord.xy+mod(uTime,100.0))-.5)*.005;
          gl_FragColor=vec4(col,1.0);
        }`});
    this.quad=new T.Mesh(new T.PlaneGeometry(2,2),material);this.postScene=new T.Scene();this.postScene.add(this.quad);this.postCamera=new T.Camera();
  }
  resize(width,height){this.target.setSize(width,height);this.uniforms.uResolution.value.set(width,height);}
  render(time,focus,night){this.renderer.info.reset();this.uniforms.uTime.value=time;this.uniforms.uFocus.value=focus;this.uniforms.uNight.value=night;this.uniforms.uAperture.value=innerWidth<700?.65:1.15;this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);}
}

export function makeAtmosphere() {
  const uniforms={uNight:{value:0},uTime:{value:0}};
  const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,toneMapped:false,
    vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vDirection;uniform float uNight,uTime;
      void main(){vec3 d=normalize(vDirection);float height=smoothstep(-.4,.7,d.y);
      vec3 day=mix(vec3(.77,.67,.36),vec3(.93,.96,.79),height);
      vec3 night=mix(vec3(.009,.038,.026),vec3(.012,.115,.070),height);
      float sun=pow(max(dot(d,normalize(vec3(1.0,.5,-.9))),0.0),16.0);
      float haze=pow(max(dot(d,normalize(vec3(-.1,.2,-1.0))),0.0),3.0);
      vec3 c=mix(day,night,uNight)+sun*mix(vec3(.5,.38,.14),vec3(.05,.22,.1),uNight);
      c+=haze*mix(vec3(.12,.1,.06),vec3(.002,.035,.018),uNight);
      gl_FragColor=vec4(c,1.0);}`});
  const sky=new T.Mesh(new T.SphereGeometry(45,32,18),material);sky.renderOrder=-10;return {sky,update(night,time){uniforms.uNight.value=night;uniforms.uTime.value=time;}};
}

export function makeScience(kernelGeometry) {
  const group=new T.Group(),rng=random(17),count=1800,positions=new Float32Array(count*3),scatter=new Float32Array(count*3),sizes=new Float32Array(count);
  const source=kernelGeometry.attributes.position;
  for(let i=0;i<count;i++){const n=Math.floor(rng()*source.count);positions[i*3]=source.getX(n);positions[i*3+1]=source.getY(n);positions[i*3+2]=source.getZ(n);scatter[i*3]=(rng()-.5)*3.7;scatter[i*3+1]=(rng()-.5)*3.4;scatter[i*3+2]=(rng()-.5)*3;sizes[i]=.5+rng();}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('aScatter',new T.BufferAttribute(scatter,3));geo.setAttribute('aSize',new T.BufferAttribute(sizes,1));
  const uniforms={uAssemble:{value:0},uOpacity:{value:1},uRatio:{value:1},uTime:{value:0}};
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms,
    vertexShader:`attribute vec3 aScatter;attribute float aSize;uniform float uAssemble,uRatio,uTime;varying float vFade;void main(){vec3 p=mix(aScatter,position,uAssemble);p+=sin(vec3(aScatter.y,aScatter.z,aScatter.x)*3.0+uTime*.3)*.015*(1.0-uAssemble);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(8.0,aSize*uRatio*18.0/-mv.z);vFade=aSize;}`,
    fragmentShader:`uniform float uOpacity;varying float vFade;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;float glow=pow(1.0-r*2.0,2.0);gl_FragColor=vec4(vec3(.63,1.0,.53)*2.0,uOpacity*glow*vFade);}`});
  const points=new T.Points(geo,mat);points.frustumCulled=false;group.add(points);
  const ringGroup=new T.Group();group.add(ringGroup);
  const ringMat=new T.MeshBasicMaterial({color:'#8cba78',transparent:true,opacity:.3,depthWrite:false});
  for(let i=0;i<3;i++){const ring=new T.Mesh(new T.TorusGeometry(.83+i*.08,.0025,4,128,Math.PI*(1.25+i*.14)),ringMat);ring.rotation.set(i*.52,Math.PI/2+i*.4,i*.65);ringGroup.add(ring);}
  function update(p,time,seed,hero) {
    const intro=1-phase(p,.16,.46),macro=phase(p,3.62,3.94)*(1-phase(p,4.44,4.68));
    group.visible=intro>.001||macro>.001;
    if(intro>.001){group.position.copy(seed.position);group.quaternion.copy(seed.quaternion);group.scale.copy(seed.scale);uniforms.uAssemble.value=phase(p,0,.26);uniforms.uOpacity.value=intro;ringMat.opacity=intro*.25;points.visible=true;}
    else {group.position.copy(hero.position);group.quaternion.identity();group.scale.copy(hero.scale);uniforms.uOpacity.value=0;ringMat.opacity=macro*.28;points.visible=false;}
    uniforms.uRatio.value=Math.min(devicePixelRatio,2);uniforms.uTime.value=time;ringGroup.rotation.y=time*.09;
  }
  return {group,update};
}

export const cameraShots=[
  // Progress, distance, horizontal composition offset, look height, orbit angle.
  [0,7.6,1.7,.1,.10],[.32,7.3,1.6,.0,-.05],[.76,7.3,1.65,-2.0,.03],
  [1.02,6.9,1.45,-3.93,0],[1.20,7.2,1.55,-3.6,0],
  [1.48,9.4,1.95,-1.05,-.06],[1.78,11.4,2.3,.15,-.10],[2.14,12.9,2.55,.7,-.08],
  [2.48,12.4,2.5,.83,.025],[2.85,4.7,1.0,1.20,.15],
  [3.36,5.5,1.2,.9,.04],[3.72,6.1,1.55,.48,-.08],
  [4.45,6.5,1.4,.44,.1],[5.05,8.5,1.9,.25,.13],[5.4,8.5,1.9,.25,.13]
];
export function sampleCamera(p){let i=0;while(i<cameraShots.length-2&&p>cameraShots[i+1][0])i++;const a=cameraShots[i],b=cameraShots[i+1],t=phase(p,a[0],b[0]);return a.slice(1).map((v,k)=>lerp(v,b[k+1],t));}
