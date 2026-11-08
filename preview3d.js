import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.querySelector("#character-canvas");
let renderer, scene, camera, character, leftArm, rightArm, raf, dragging=false, lastX=0, rotation=0;
function makeMaterial(color, roughness=0.85){ return new THREE.MeshStandardMaterial({color,roughness}); }
function box(parent, size, color, pos, radius=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),makeMaterial(color));
  mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function sphere(parent, scale, color, pos, seg=12){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,seg,Math.max(8,seg-2)),makeMaterial(color));
  mesh.scale.set(...scale); mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function limb(parent, radiusTop, radiusBottom, length, color, pos){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radiusTop,radiusBottom,length,8),makeMaterial(color));
  mesh.position.set(...pos); mesh.castShadow=true; parent.add(mesh); return mesh;
}
function init(){
  if(!canvas || !window.THREE_PREVIEW_READY===false) return;
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene(); scene.background=new THREE.Color("#a9c9d8"); scene.fog=new THREE.Fog("#a9c9d8",13,28);
  camera=new THREE.PerspectiveCamera(34,1,.1,100); camera.position.set(4.8,3.1,7.2); camera.lookAt(0,1.35,0);
  scene.add(new THREE.HemisphereLight(0xeaf6ff,0x596047,2.0));
  const sun=new THREE.DirectionalLight(0xffe1bd,3.1); sun.position.set(-4,8,5); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(11,48),makeMaterial("#657d4c")); ground.rotation.x=-Math.PI/2; ground.position.y=-.04; ground.receiveShadow=true; scene.add(ground);
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.25,.16,12),makeMaterial("#b7a17d")); platform.position.y=.04; platform.receiveShadow=true; platform.castShadow=true; scene.add(platform);
  character=new THREE.Group(); scene.add(character);
  const skin="#9b6245", orange="#f07824", denim="#315b91", dark="#28201b", shoe="#292b30";
  // Legs and shoes
  limb(character,.14,.17,.78,denim,[-.22,.55,0]);
  limb(character,.14,.17,.78,denim,[.22,.55,0]);
  box(character,[.28,.14,.43],shoe,[-.22,.16,.1]); box(character,[.28,.14,.43],shoe,[.22,.16,.1]);
  // torso and neck
  box(character,[.78,.86,.42],orange,[0,1.48,0]);
  limb(character,.12,.12,.18,skin,[0,1.98,0]);
  // head
  sphere(character,[.39,.43,.35],skin,[0,2.35,0],16);
  // bowl haircut: cap + lower fringe, dark brown
  sphere(character,[.415,.25,.38],dark,[0,2.57,-.015],16);
  box(character,[.75,.13,.12],dark,[0,2.42,.31]);
  // ears, eyes, nose, smile
  sphere(character,[.07,.1,.07],skin,[-.39,2.35,0],8); sphere(character,[.07,.1,.07],skin,[.39,2.35,0],8);
  sphere(character,[.035,.045,.018],"#211b18",[-.14,2.39,.337],8); sphere(character,[.035,.045,.018],"#211b18",[.14,2.39,.337],8);
  sphere(character,[.045,.06,.045],skin,[0,2.29,.35],8);
  // arms with pivot animation
  leftArm=new THREE.Group(); leftArm.position.set(-.48,1.82,0); character.add(leftArm);
  limb(leftArm,.105,.13,.72,orange,[0,-.34,0]); sphere(leftArm,[.12,.13,.12],skin,[0,-.73,.02],8);
  rightArm=new THREE.Group(); rightArm.position.set(.48,1.82,0); character.add(rightArm);
  limb(rightArm,.105,.13,.72,orange,[0,-.34,0]); sphere(rightArm,[.12,.13,.12],skin,[0,-.73,.02],8);
  // background trees and distant hills
  for(let i=0;i<9;i++){
    const x=(i-4)*2.5, z=-4.5-(i%3)*1.2;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.8,6),makeMaterial("#66513a")); trunk.position.set(x,.4,z); scene.add(trunk);
    const crown=new THREE.Mesh(new THREE.ConeGeometry(.65,1.5,7),makeMaterial(i%2?"#496b49":"#58764d")); crown.position.set(x,1.45,z); scene.add(crown);
  }
  resize();
  canvas.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener("pointermove",e=>{if(!dragging)return;rotation+=(e.clientX-lastX)*.012;lastX=e.clientX});
  canvas.addEventListener("pointerup",()=>dragging=false); canvas.addEventListener("pointercancel",()=>dragging=false);
  const clock=new THREE.Clock();
  function animate(){raf=requestAnimationFrame(animate);const t=clock.getElapsedTime();character.rotation.y=rotation+Math.sin(t*.35)*.12;character.position.y=.04+Math.sin(t*2)*.025;leftArm.rotation.x=Math.sin(t*1.5)*.08;rightArm.rotation.x=-Math.sin(t*1.5)*.08;renderer.render(scene,camera)}
  animate();
}
function resize(){if(!renderer||!canvas)return;const w=canvas.clientWidth||600,h=canvas.clientHeight||320;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
if(canvas){
  try{init();new ResizeObserver(resize).observe(canvas);}
  catch(error){const p=document.createElement("p");p.className="hint";p.textContent="Não foi possível carregar a prévia 3D neste navegador. Confira a conexão e tente atualizar a página.";canvas.replaceWith(p);console.error(error)}
}
window.addEventListener("vf:preview",()=>{if(character)character.visible=true});
