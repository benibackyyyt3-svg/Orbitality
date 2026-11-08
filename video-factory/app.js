import { compilarStoryboard } from './roteiro/compilar.js';
import { renderizarVideo, suportaExportacao } from './render/exportar.js';

const $ = (id) => document.getElementById(id);
const cfg = window.VF_CONFIG || {};
const FORMATOS = { vertical: { largura: 1080, altura: 1920 }, horizontal: { largura: 1920, altura: 1080 } };
let urlVideo = null;
let abortar = null;

function progresso(frac, texto) {
  $('barra').style.width = `${Math.round(frac * 100)}%`;
  $('pct').textContent = `${Math.round(frac * 100)}%`;
  if (texto) $('etapa').textContent = texto;
}
function erro(msg) { $('erro').textContent = msg; $('erro').hidden = false; }

async function pegarRoteiro(tema, duracao) {
  let r;
  try { r = await fetch(cfg.roteiroUrl || '/api/roteiro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tema, duracao }) }); }
  catch { throw new Error('Sem conexão com o servidor do roteiro. Verifique a internet e tente de novo.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `Falha ao criar o roteiro (${r.status}).`);
  return j;
}

async function pegarVoz(frases, voz, signal) {
  if (!cfg.ttsUrl) throw new Error('O serviço de voz ainda não foi configurado (video-factory/config.js → ttsUrl).');
  let r;
  try { r = await fetch(`${cfg.ttsUrl.replace(/\/$/, '')}/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ frases, voz }), signal }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Não consegui falar com o serviço de voz. Se ele estava dormindo, aguarde 1 minuto e tente de novo.'); }
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.erro || `Falha na narração (${r.status}).`); }
  const marcas = JSON.parse(r.headers.get('X-Marcas') || '[]');
  const buf = await new AudioContext().decodeAudioData(await r.arrayBuffer());
  return { buf, marcas };
}

async function gerar() {
  $('erro').hidden = true;
  const tema = $('tema').value.trim();
  if (tema.length < 3) return erro('Escreva o assunto do vídeo.');
  if (!suportaExportacao()) return erro('Este navegador não consegue exportar vídeo. Use o Chrome atualizado (Android ou computador).');
  const duracao = Number($('duracao').value);
  const qs = new URLSearchParams(location.search);
  const esc = Number(qs.get('escala')) || 1; // uso avançado/testes: ?escala=0.5 reduz a resolução
  const f0 = FORMATOS[$('formato').value];
  const formato = { largura: Math.round((f0.largura * esc) / 2) * 2, altura: Math.round((f0.altura * esc) / 2) * 2 };
  const fps = Number(qs.get('fps')) || 30;
  const ctl = new AbortController();
  abortar = ctl;
  $('gerar').disabled = true; $('cancelar').hidden = false; $('resultado').hidden = true; $('prog').hidden = false;
  try {
    progresso(0.02, 'A IA está escrevendo o roteiro…');
    const roteiro = await pegarRoteiro(tema, duracao);
    progresso(0.08, 'Gravando a narração…');
    const { buf, marcas } = await pegarVoz(roteiro.cenas.map((c) => c.fala), $('voz').value, ctl.signal);
    if (marcas.length !== roteiro.cenas.length) throw new Error('A narração voltou incompleta. Tente de novo.');
    progresso(0.15, 'Montando as cenas 3D…');
    const { storyboard, palavras } = compilarStoryboard({ roteiro, marcas, duracaoAudio: buf.duration, formato: { ...formato, fps } });
    const { blob, audioCodec } = await renderizarVideo({
      sb: storyboard, palavras, narracao: buf, volNarracao: 1, volMusica: Number($('musica').value) / 100, signal: ctl.signal,
      onProgresso: (p) => progresso(0.15 + p.fracao * 0.85, p.etapa),
    });
    if (urlVideo) URL.revokeObjectURL(urlVideo);
    urlVideo = URL.createObjectURL(blob);
    $('video').src = urlVideo;
    const nome = `${storyboard.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video'}.mp4`;
    $('baixar').href = urlVideo; $('baixar').download = nome;
    $('info').textContent = `${storyboard.titulo} · ${Math.round(storyboard.duracao)} s · ${(blob.size / 1e6).toFixed(1)} MB${audioCodec === 'opus' ? ' · áudio Opus (este aparelho não tem AAC)' : ''}`;
    $('resultado').hidden = false;
    progresso(1, 'Pronto!');
  } catch (e) {
    if (e.name === 'AbortError') progresso(0, 'Cancelado.');
    else { console.error(e); erro(e.message || String(e)); $('prog').hidden = true; }
  } finally {
    $('gerar').disabled = false; $('cancelar').hidden = true; abortar = null;
  }
}
$('gerar').onclick = gerar;
$('cancelar').onclick = () => abortar?.abort();
$('musica').oninput = () => { $('musicaVal').textContent = `${$('musica').value}%`; };
if (!suportaExportacao()) erro('Este navegador não consegue exportar vídeo. Use o Chrome atualizado (Android ou computador).');
