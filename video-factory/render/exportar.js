// Renderização do vídeo NO NAVEGADOR do usuário (GPU do celular/PC):
//   motor 3D do kit (iframe) → quadro composto (3D + legendas/textos) → WebCodecs H.264 → áudio AAC (ou Opus) → MP4.
// Nada é enviado para servidor: o vídeo nasce e fica no aparelho.
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';
import { mixarAudio } from './audio.js';

const BASE = new URL('../', import.meta.url);

export function suportaExportacao() {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

async function escolherCodecs(W, H, fps, bitrate) {
  // H.264 High; tenta níveis maiores para 1080p/60 e cai para perfis menores se o aparelho não aceitar.
  const candidatosV = ['avc1.640028', 'avc1.64002A', 'avc1.4D4028', 'avc1.42E01F'];
  let video = null;
  for (const codec of candidatosV) {
    const cfg = { codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) { video = r.config; break; } } catch { /* tenta o próximo */ }
  }
  if (!video) throw new Error('Este aparelho não consegue codificar vídeo H.264 no navegador. Use o Chrome atualizado (Android ou computador).');
  let audio = null;
  for (const [codec, nome] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 };
    try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) { audio = { config: r.config, nome }; break; } } catch { /* próximo */ }
  }
  if (!audio) throw new Error('Este aparelho não consegue codificar o áudio do vídeo.');
  return { video, audio };
}

function abrirMotor(sb, palavras, W, H) {
  return new Promise((resolve, reject) => {
    window.__VF = { sb, palavras };
    const f = document.createElement('iframe');
    f.style.cssText = `position:fixed;left:-${W + 50}px;top:0;width:${W}px;height:${H}px;border:0;pointer-events:none`;
    f.src = new URL(`engine/player.html?inline=1&render=1&w=${W}&h=${H}`, BASE).href;
    document.body.appendChild(f);
    const t0 = Date.now();
    const espera = setInterval(() => {
      const w = f.contentWindow;
      if (w?.__erro) { clearInterval(espera); f.remove(); reject(new Error(`Motor 3D: ${w.__erro}`)); }
      else if (w?.__pronto) { clearInterval(espera); resolve(f); }
      else if (Date.now() - t0 > 120000) { clearInterval(espera); f.remove(); reject(new Error('O motor 3D demorou demais para carregar.')); }
    }, 100);
  });
}

// Legendas/textos/setas são HTML por cima do 3D: viram imagem (SVG foreignObject) e são coladas no quadro.
function criarCamadaHtml(frame, W, H, css) {
  const doc = frame.contentDocument;
  const camadas = doc.getElementById('camadas');
  const palco = doc.getElementById('palco');
  const u = palco.style.getPropertyValue('--u');
  let ultima = '';
  let img = null;
  return async (ctx) => {
    const vazio = !camadas.querySelector('#legenda')?.textContent?.trim()
      && ![...camadas.querySelectorAll('#textos > *, #elementos > *')].some((e) => e.style.display && e.style.display !== 'none')
      && Number(camadas.querySelector('#fx').style.opacity || 0) < 0.01;
    if (vazio) return;
    const clone = camadas.cloneNode(true);
    clone.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;`;
    const xml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${W}px;height:${H}px;--u:${u};`
      + `font-family:'Arial Black','Segoe UI Black',Impact,system-ui,sans-serif"><style>${css}</style>${xml}</div></foreignObject></svg>`;
    if (svg !== ultima) {
      ultima = svg;
      img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
    }
    ctx.drawImage(img, 0, 0, W, H);
  };
}

function aplicarEfeitosDoCanvas(ctx, tela, W, H) {
  const filtro = tela.style.filter;
  ctx.filter = filtro && filtro !== 'none' ? filtro : 'none';
  const tr = tela.style.transform;
  if (tr && tr !== 'none') {
    const tm = tr.match(/translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/);
    const sm = tr.match(/scale\(([-\d.e]+)\)/);
    const tx = tm ? Number(tm[1]) : 0;
    const ty = tm ? Number(tm[2]) : 0;
    const s = sm ? Number(sm[1]) : 1;
    ctx.translate(W / 2 + tx, H / 2 + ty);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -H / 2);
  }
}

/**
 * @param {object} o
 * @param {object} o.sb          storyboard validado
 * @param {Array}  o.palavras    [{palavra, inicio, fim}]
 * @param {AudioBuffer} o.narracao
 * @param {number} [o.volNarracao=1]
 * @param {number} [o.volMusica=0.12]  0 = sem música
 * @param {(p:{etapa:string,fracao:number})=>void} [o.onProgresso]
 * @param {AbortSignal} [o.signal]
 * @returns {Promise<{blob:Blob, audioCodec:string, segundos:number}>}
 */
export async function renderizarVideo(o) {
  const { sb, palavras, narracao, onProgresso = () => {}, signal } = o;
  const W = Math.round((sb.formato?.largura || 1080) / 2) * 2;
  const H = Math.round((sb.formato?.altura || 1920) / 2) * 2;
  const fps = sb.formato?.fps || 30;
  const dur = sb.duracao;
  const total = Math.round(dur * fps);
  const bitrate = Math.round(W * H * fps * 0.11); // ~7 Mbps em 1080p30
  const checar = () => { if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError'); };

  onProgresso({ etapa: 'Preparando o codificador de vídeo', fracao: 0 });
  const { video, audio } = await escolherCodecs(W, H, fps, bitrate);

  onProgresso({ etapa: 'Carregando personagens e cenários 3D', fracao: 0 });
  const css = await (await fetch(new URL('engine/player.css', BASE))).text();
  const frame = await abrirMotor(sb, palavras, W, H);
  let wakeLock = null;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }

  try {
    const tela = frame.contentDocument.getElementById('tela');
    const palco2d = new OffscreenCanvas(W, H);
    const ctx = palco2d.getContext('2d', { alpha: false });
    const camadaHtml = criarCamadaHtml(frame, W, H, css);

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target, fastStart: 'in-memory',
      video: { codec: 'avc', width: W, height: H, frameRate: fps },
      audio: { codec: audio.nome === 'aac' ? 'aac' : 'opus', sampleRate: 48000, numberOfChannels: 2 },
    });
    let erroCodec = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { erroCodec = e; } });
    venc.configure(video);
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { erroCodec = e; } });
    aenc.configure(audio.config);

    // vídeo: um quadro 3D por vez (o motor é função pura do tempo, então o resultado é exato)
    for (let i = 0; i < total; i++) {
      checar();
      if (erroCodec) throw new Error(`Falha no codificador: ${erroCodec.message}`);
      const t = i / fps;
      frame.contentWindow.renderAt(t);
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      aplicarEfeitosDoCanvas(ctx, tela, W, H);
      ctx.drawImage(tela, 0, 0, W, H);
      ctx.restore();
      ctx.filter = 'none';
      await camadaHtml(ctx);
      const vf = new VideoFrame(palco2d, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      if (i % 5 === 0) {
        onProgresso({ etapa: 'Desenhando o vídeo em 3D', fracao: (i / total) * 0.9 });
        await new Promise((r) => setTimeout(r, 0)); // deixa a página respirar
      }
    }
    await venc.flush();

    // áudio: narração + música, 48 kHz estéreo, em blocos de 1 s
    onProgresso({ etapa: 'Mixando e codificando o áudio', fracao: 0.92 });
    const mix = await mixarAudio({ narracao, duracao: dur, volNarracao: o.volNarracao ?? 1, volMusica: o.volMusica ?? 0.12 });
    const passo = 48000;
    for (let off = 0; off < mix.length; off += passo) {
      checar();
      const n = Math.min(passo, mix.length - off);
      const planar = new Float32Array(n * 2);
      planar.set(mix.getChannelData(0).subarray(off, off + n), 0);
      planar.set(mix.getChannelData(1).subarray(off, off + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / 48000) * 1e6), data: planar });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
    if (erroCodec) throw new Error(`Falha no codificador: ${erroCodec.message}`);

    muxer.finalize();
    onProgresso({ etapa: 'Finalizando o MP4', fracao: 1 });
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), audioCodec: audio.nome, segundos: dur };
  } finally {
    frame.remove();
    try { await wakeLock?.release(); } catch { /* ok */ }
  }
}
