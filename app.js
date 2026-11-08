
function seoHtml(seo){if(!seo)return "";return '<div class="scene"><h3>SEO para YouTube</h3><p><b>Título:</b> '+esc(seo.youtube_title||"")+'</p><p><b>Palavra-chave principal:</b> '+esc(seo.primary_keyword||"")+'</p><p><b>Descrição:</b><br>'+esc(seo.description||"").replace(/\n/g,"<br>")+'</p><p><b>Tags:</b> '+esc((seo.tags||[]).join(", "))+'</p><p><b>Hashtags:</b> '+esc((seo.hashtags||[]).join(" "))+'</p><p><b>Palavras-chave:</b> '+esc((seo.secondary_keywords||[]).join(", "))+'</p></div>'}
function crc32(bytes){let c=-1;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^-1)>>>0}
function zipStore(files){const enc=new TextEncoder(),local=[],central=[];let offset=0;for(const file of files){const name=enc.encode(file.name),data=file.data instanceof Uint8Array?file.data:new Uint8Array(file.data),crc=crc32(data),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0,true);v.setUint16(8,0,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);local.push(h,data);const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0,true);d.setUint16(10,0,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+data.length}const size=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);return new Blob([...local,...central,end],{type:"application/zip"})}
function safeName(s){return String(s||"video").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"video"}
const $=s=>document.querySelector(s);let latest=null;
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(data){latest=data;$("#result-title").textContent=data.title||"Projeto criado";const scenes=Array.isArray(data.scenes)?data.scenes:[];$("#result-body").innerHTML='<div class="scene"><h3>Personagem principal</h3><p>'+esc(data.main_character||"Homem pardo, cabelo tigela, camiseta laranja e calça jeans azul. Manter aparência consistente em todas as cenas.")+'</p></div><div class="scene"><h3>Resumo</h3><p>'+esc(data.synopsis||"")+'</p></div>'+scenes.map((s,i)=>'<div class="scene"><span class="tag">CENA '+(i+1)+'</span><h3>'+esc(s.title||"Cena")+'</h3><p><b>Visual:</b> '+esc(s.visual||"")+'</p><p><b>Ação:</b> '+esc(s.action||"")+'</p><p><b>Câmera:</b> '+esc(s.camera||"")+'</p><p><b>Narração:</b> '+esc(s.narration||"")+'</p><p><b>Objetos:</b> '+esc((s.props||[]).join(", "))+'</p></div>').join("")+'<div class="scene"><h3>Áudio</h3><p>'+esc(data.audio_direction||"Narração em português brasileiro.")+'</p></div>'+seoHtml(data.seo);$("#result").classList.remove("hidden");$("#preview3d").classList.remove("hidden");window.dispatchEvent(new CustomEvent("vf:preview",{detail:{title:data.title||"Projeto",topic:data.synopsis||data.title||""}}));$("#result").scrollIntoView({behavior:"smooth"});}
$("#format").addEventListener("change",()=>{$("#duration").value=$("#format").value==="9:16"?"auto":"600"});
$("#generate").addEventListener("click",async()=>{const topic=$("#topic").value.trim();if(!topic){$("#topic").focus();return}const btn=$("#generate");btn.disabled=true;$("#progress").classList.remove("hidden");$("#result").classList.add("hidden");try{const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,duration:$("#duration").value==="auto"?null:Number($("#duration").value),duration_mode:$("#duration").value==="auto"?"shorts-auto":"fixed",format:$("#format").value})});const body=await res.json();if(!res.ok)throw new Error(body.error||"Falha ao gerar");render(body)}catch(e){alert(e.message+"\n\nConfira se a API Gemini foi configurada nas variáveis secretas do servidor.")}finally{btn.disabled=false;$("#progress").classList.add("hidden")}});
$("#download").addEventListener("click",()=>{if(!latest)return;const blob=new Blob([JSON.stringify(latest,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="video-factory-roteiro.json";a.click();URL.revokeObjectURL(a.href)});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
async function exportWebM(){
 if(!latest){alert("Gere um projeto antes de exportar.");return}
 const btn=$("#export-webm");
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){alert("Este navegador não permite gravar WebM. Tente abrir o site no Chrome atualizado.");return}
 btn.disabled=true;btn.textContent="Preparando...";
 const vertical=latest.format==="9:16",canvas=document.createElement("canvas");
 canvas.width=vertical?480:854;canvas.height=vertical?854:480;
 const ctx=canvas.getContext("2d");
 if(!ctx){btn.disabled=false;btn.textContent="Exportar vídeo WebM";alert("Não foi possível preparar a imagem do vídeo.");return}
 const scenes=Array.isArray(latest.scenes)&&latest.scenes.length?latest.scenes:[{title:latest.title||"Sua história",visual:latest.synopsis||""}];
 const per=3,total=per*scenes.length;
 let stream,recorder,raf;
 const chunks=[];
 const box=document.querySelector("#scene-export-progress")||document.createElement("div");
 box.id="scene-export-progress";box.className="scene-export-progress";btn.insertAdjacentElement("afterend",box);
 box.innerHTML='<b id="export-status">Preparando vídeo...</b><div class="export-track"><div id="export-overall-bar"></div></div><p class="hint" id="export-percent">0%</p>';
 const wrap=(value,max,font)=>{ctx.font=font;const lines=[];let line="";for(const word of String(value||"").split(/\s+/)){const test=line?line+" "+word:word;if(ctx.measureText(test).width>max&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);return lines};
 function draw(now){
  const elapsed=(now-began)/1000,index=Math.min(scenes.length-1,Math.floor(elapsed/per)),s=scenes[index],w=canvas.width,h=canvas.height,pad=w*.08;
  const pct=Math.min(100,Math.floor(elapsed/total*100));$("#export-percent").textContent=pct+"%";$("#export-overall-bar").style.width=pct+"%";
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,"#171923");g.addColorStop(1,"#49301f");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.fillStyle="rgba(255,137,50,.16)";ctx.beginPath();ctx.arc(w*.8+Math.sin(now/1500)*10,h*.22,w*.22,0,7);ctx.fill();
  ctx.fillStyle="#ff9b50";ctx.font="bold "+Math.round(w*.027)+"px system-ui";ctx.fillText("VIDEO FACTORY AI",pad,h*.13);
  ctx.fillStyle="#fff";const tf="bold "+Math.round(w*.055)+"px system-ui";let y=h*.34;
  for(const line of wrap(s.title||("Cena "+(index+1)),w-pad*2,tf).slice(0,3)){ctx.font=tf;ctx.fillText(line,pad,y);y+=w*.07}
  ctx.fillStyle="#e3e5eb";const bf=Math.round(w*.03)+"px system-ui";y=Math.max(y+h*.08,h*.55);
  for(const line of wrap([s.visual,s.action,s.narration].filter(Boolean).join(" — "),w-pad*2,bf).slice(0,7)){ctx.font=bf;ctx.fillText(line,pad,y);y+=w*.045}
  ctx.fillStyle="#ffffff40";ctx.fillRect(pad,h*.89,w-pad*2,6);ctx.fillStyle="#ff8a32";ctx.fillRect(pad,h*.89,(w-pad*2)*Math.min(1,elapsed/total),6);
  ctx.fillStyle="#c5c8d0";ctx.font=Math.round(w*.02)+"px system-ui";ctx.fillText("CENA "+(index+1)+" / "+scenes.length,pad,h*.95);
  if(elapsed<total){raf=requestAnimationFrame(draw)}else{cancelAnimationFrame(raf);if(recorder&&recorder.state!=="inactive")recorder.stop()}
 }
 function showDownload(blob){
  stream?.getTracks().forEach(t=>t.stop());
  if(!blob||blob.size<1000){btn.disabled=false;btn.textContent="Tentar exportar novamente";$("#export-status").textContent="A gravação ficou vazia. Tente novamente com a página aberta.";return}
  const base=safeName(latest.title),videoUrl=URL.createObjectURL(blob);
  let direct=document.querySelector("#webm-download-link");
  if(!direct){direct=document.createElement("a");direct.id="webm-download-link";direct.className="primary";direct.style.display="block";direct.style.textAlign="center";direct.style.padding="14px";direct.style.borderRadius="10px";direct.style.textDecoration="none";btn.insertAdjacentElement("afterend",direct)}
  direct.href=videoUrl;direct.download=base+".webm";direct.textContent="⬇ BAIXAR VÍDEO WEBM";
  $("#export-status").textContent="Vídeo pronto! Toque em BAIXAR VÍDEO WEBM.";
  btn.disabled=false;btn.textContent="Exportar novamente";
  const seo=latest.seo||{},tags=(seo.tags||[]).join(", "),hashtags=(seo.hashtags||[]).join(" ");
  const metadata={title:seo.youtube_title||latest.title,description:seo.description||"",tags:seo.tags||[],hashtags:seo.hashtags||[],format:latest.format};
  const zip=zipStore([{name:base+"/video.webm",data:new Uint8Array([])},{name:base+"/descricao-youtube.txt",data:new TextEncoder().encode((seo.youtube_title||latest.title)+"\n\n"+(seo.description||"")+"\n\n"+hashtags)},{name:base+"/tags-youtube.txt",data:new TextEncoder().encode(tags)},{name:base+"/seo-metadata.json",data:new TextEncoder().encode(JSON.stringify(metadata,null,2))},{name:base+"/roteiro.json",data:new TextEncoder().encode(JSON.stringify(latest,null,2))}]);
  // O ZIP contém os arquivos de SEO; o vídeo WebM é baixado separadamente acima.
  let zipLink=document.querySelector("#seo-zip-link");
  if(!zipLink){zipLink=document.createElement("a");zipLink.id="seo-zip-link";zipLink.className="secondary";zipLink.style.display="inline-block";zipLink.style.marginTop="10px";zipLink.style.padding="12px";zipLink.style.borderRadius="10px";zipLink.style.textDecoration="none";direct.insertAdjacentElement("afterend",zipLink)}
  zipLink.href=URL.createObjectURL(zip);zipLink.download=base+"-seo.zip";zipLink.textContent="Baixar arquivos SEO (ZIP)";
 }
 try{
  let mime="video/webm;codecs=vp8";
  if(!MediaRecorder.isTypeSupported(mime))mime="video/webm";
  if(!MediaRecorder.isTypeSupported(mime))throw new Error("Seu navegador não oferece o formato WebM.");
  stream=canvas.captureStream(20);
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1200000});
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  recorder.onerror=()=>{cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());btn.disabled=false;btn.textContent="Tentar exportar novamente";$("#export-status").textContent="O navegador interrompeu a gravação. Tente novamente."};
  recorder.onstop=()=>showDownload(new Blob(chunks,{type:mime}));
  const began=performance.now();recorder.start(500);btn.textContent="Exportando... mantenha esta página aberta";requestAnimationFrame(draw);
 }catch(error){stream?.getTracks().forEach(t=>t.stop());btn.disabled=false;btn.textContent="Exportar vídeo WebM";$("#export-status").textContent=error.message;alert(error.message)}
}
$("#export-webm").textContent="Exportar vídeo WebM";
$("#export-webm").addEventListener("click",exportWebM);
