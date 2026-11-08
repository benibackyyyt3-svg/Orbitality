const $=s=>document.querySelector(s);let latest=null;
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(data){latest=data;$("#result-title").textContent=data.title||"Projeto criado";const scenes=Array.isArray(data.scenes)?data.scenes:[];$("#result-body").innerHTML='<div class="scene"><h3>Personagem principal</h3><p>'+esc(data.main_character||"Homem pardo, cabelo tigela, camiseta laranja e calça jeans azul. Manter aparência consistente em todas as cenas.")+'</p></div><div class="scene"><h3>Resumo</h3><p>'+esc(data.synopsis||"")+'</p></div>'+scenes.map((s,i)=>'<div class="scene"><span class="tag">CENA '+(i+1)+'</span><h3>'+esc(s.title||"Cena")+'</h3><p><b>Visual:</b> '+esc(s.visual||"")+'</p><p><b>Ação:</b> '+esc(s.action||"")+'</p><p><b>Câmera:</b> '+esc(s.camera||"")+'</p><p><b>Narração:</b> '+esc(s.narration||"")+'</p><p><b>Objetos:</b> '+esc((s.props||[]).join(", "))+'</p></div>').join("")+'<div class="scene"><h3>Áudio</h3><p>'+esc(data.audio_direction||"Narração em português brasileiro.")+'</p></div>';$("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth"});}
$("#format").addEventListener("change",()=>{$("#duration").value=$("#format").value==="9:16"?"auto":"600"});
$("#generate").addEventListener("click",async()=>{const topic=$("#topic").value.trim();if(!topic){$("#topic").focus();return}const btn=$("#generate");btn.disabled=true;$("#progress").classList.remove("hidden");$("#result").classList.add("hidden");try{const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,duration:$("#duration").value==="auto"?null:Number($("#duration").value),duration_mode:$("#duration").value==="auto"?"shorts-auto":"fixed",format:$("#format").value})});const body=await res.json();if(!res.ok)throw new Error(body.error||"Falha ao gerar");render(body)}catch(e){alert(e.message+"\n\nConfira se a API Gemini foi configurada nas variáveis secretas do servidor.")}finally{btn.disabled=false;$("#progress").classList.add("hidden")}});
$("#download").addEventListener("click",()=>{if(!latest)return;const blob=new Blob([JSON.stringify(latest,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="video-factory-roteiro.json";a.click();URL.revokeObjectURL(a.href)});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
async function exportWebM(){
 if(!latest)return;
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){alert("Seu navegador não oferece gravação WebM. Atualize o Chrome.");return}
 const btn=$("#export-webm");btn.disabled=true;btn.textContent="Preparando vídeo...";
 const vertical=latest.format==="9:16",canvas=document.createElement("canvas");canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;
 const ctx=canvas.getContext("2d"),scenes=Array.isArray(latest.scenes)&&latest.scenes.length?latest.scenes:[{title:latest.title||"Sua história",visual:latest.synopsis||""}];
 const total=Math.max(15,Number(latest.duration)||90),per=total/scenes.length,stream=canvas.captureStream(24);
 let mime="video/webm;codecs=vp8";if(!MediaRecorder.isTypeSupported(mime))mime="video/webm";
 if(!MediaRecorder.isTypeSupported(mime)){btn.disabled=false;btn.textContent="Exportar vídeo WebM";alert("WebM não é compatível com este navegador.");return}
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000}),chunks=[];recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
 const wrap=(value,max,font)=>{ctx.font=font;let lines=[],line="";for(const word of String(value||"").split(/\s+/)){const test=line?line+" "+word:word;if(ctx.measureText(test).width>max&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);return lines};
 const started=performance.now();let raf;
 function draw(now){const elapsed=(now-started)/1000,index=Math.min(scenes.length-1,Math.floor(elapsed/per)),s=scenes[index],w=canvas.width,h=canvas.height,pad=w*.09;
 const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,"#171923");g.addColorStop(1,"#49301f");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.fillStyle="rgba(255,137,50,.12)";ctx.beginPath();ctx.arc(w*.8+Math.sin(now/2500)*12,h*.22,w*.24,0,7);ctx.fill();
 ctx.fillStyle="#ff9b50";ctx.font="bold "+Math.round(w*.025)+"px system-ui";ctx.fillText("VIDEO FACTORY AI",pad,h*.13);
 ctx.fillStyle="#fff";const titleFont="bold "+Math.round(w*.052)+"px system-ui";let y=h*.32;for(const line of wrap(s.title||("Cena "+(index+1)),w-pad*2,titleFont).slice(0,3)){ctx.font=titleFont;ctx.fillText(line,pad,y);y+=w*.068}
 ctx.fillStyle="#e3e5eb";const bodyFont=Math.round(w*.027)+"px system-ui";y=Math.max(y+h*.08,h*.53);for(const line of wrap([s.visual,s.action].filter(Boolean).join(" — "),w-pad*2,bodyFont).slice(0,7)){ctx.font=bodyFont;ctx.fillText(line,pad,y);y+=w*.039}
 ctx.fillStyle="rgba(255,255,255,.2)";ctx.fillRect(pad,h*.88,w-pad*2,8);ctx.fillStyle="#ff8a32";ctx.fillRect(pad,h*.88,(w-pad*2)*Math.min(1,elapsed/total),8);
 ctx.fillStyle="#c5c8d0";ctx.font=Math.round(w*.018)+"px system-ui";ctx.fillText("CENA "+(index+1)+" / "+scenes.length,pad,h*.94);
 if(elapsed<total)raf=requestAnimationFrame(draw);else{cancelAnimationFrame(raf);recorder.stop()}}
 recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:"video/webm"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="video-factory-"+(vertical?"shorts":"horizontal")+".webm";a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);btn.disabled=false;btn.textContent="Exportar vídeo WebM"};
 try{recorder.start(1000);requestAnimationFrame(draw);btn.textContent="Gravando... mantenha a página aberta"}catch(e){btn.disabled=false;btn.textContent="Exportar vídeo WebM";alert("Falha ao iniciar: "+e.message)}
}
$("#export-webm").addEventListener("click",exportWebM);
