// Compilador: transforma o roteiro simples da IA (só nomes que existem no pacote) + tempos reais da narração
// em um storyboard completo do motor 3D do kit. A IA NUNCA escreve coordenadas, câmeras ou código:
// aqui o layout, a câmera, o tempo e as animações são montados de forma determinística e validada.
import catalogo from './catalogo.js';

export const FUNDOS = ['campo', 'cidade', 'floresta', 'deserto', 'litoral', 'industrial', 'interior'];
export const HORARIOS = ['dia', 'tarde', 'nublado'];
export const PLANOS = ['geral', 'medio', 'close', 'topo'];
export const MATERIAIS = ['pedra', 'brita', 'areia', 'terra', 'concreto', 'asfalto', 'agua', 'fumaca', 'vapor', 'poeira', 'ar', 'bolha', 'neve', 'eletricidade', 'luz', 'fagulha', 'fogo'];
export const ACOES = ['talk', 'point', 'wave', 'think', 'cheer', 'surprised', 'shrug', 'nod', 'shake_head', 'look_around', 'hammer', 'dig', 'carry', 'push', 'crouch', 'read_clipboard', 'walk', 'run', 'idle'];
export const EXPRESSOES = catalogo.expressoes;
export const PERSONAGENS = ['apresentador', ...catalogo.personagens.map((p) => p.id).filter((id) => id !== 'homem' || true)];
export const ASSETS = catalogo.cenario.map((a) => a.id);
const POR_ID = Object.fromEntries(catalogo.cenario.map((a) => [a.id, a]));
const DECOR = new Set(['arvore_redonda', 'arvore_frutifera', 'arvore_pinheiro', 'palmeira', 'arbusto', 'cone', 'poste_luz', 'banco', 'lixeira', 'hidrante']);
const CHAO_POR_FUNDO = { campo: 'grama', cidade: 'concreto', floresta: 'grama', deserto: 'areia', litoral: 'areia', industrial: 'concreto', interior: 'madeira' };

// Apresentador padrão do canal: homem pardo, cabelo tigela, camisa laranja e calça jeans.
const APRESENTADOR = {
  preset: 'homem',
  overrides: { skin: '#c68642', top: { color: '#f28c28', sleeves: 'short' }, bottom: { color: '#3d5a80', type: 'pants' }, hair: { style: 'fringe', color: '#1c1410' } },
};

const num = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
const r2 = (x) => Math.round(x * 100) / 100;
const pick = (v, lista, d) => (lista.includes(v) ? v : d);

function pesoPalavra(p) {
  let w = p.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5;
  if (/[,;:]$/.test(p)) w += 3;
  if (/[.!?…]$/.test(p)) w += 6;
  return w;
}

/** Tempo de cada palavra, distribuído dentro da janela real da frase falada. */
export function palavrasDeCena(texto, ini, fim) {
  const ws = texto.split(/\s+/).filter(Boolean);
  const pesos = ws.map(pesoPalavra);
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  const util = Math.max(0.1, fim - ini);
  let t = ini;
  return ws.map((palavra, i) => {
    const d = (pesos[i] / soma) * util;
    const o = { palavra, inicio: r2(t), fim: r2(t + d * 0.92) };
    t += d;
    return o;
  });
}

function montarObjetos(cena, idx, fundo) {
  const lista = (cena.cenario || []).map((o) => (typeof o === 'string' ? { asset: o } : o)).filter((o) => POR_ID[o.asset]);
  if (!lista.length) lista.push({ asset: 'casa_simples' });
  const principais = lista.filter((o) => !DECOR.has(o.asset)).slice(0, 3);
  const decor = lista.filter((o) => DECOR.has(o.asset)).slice(0, 4);
  if (!principais.length) principais.push(decor.shift() || { asset: 'casa_simples' });
  const objetos = [];
  let frente = 0;
  let larguraTotal = POR_ID[principais[0].asset].x;
  principais.forEach((o, i) => {
    const info = POR_ID[o.asset];
    const veiculo = ['veiculos'].includes(info.cat);
    let x = 0;
    if (i > 0) {
      const lado = i % 2 ? 1 : -1;
      x = lado * (larguraTotal / 2 + info.x / 2 + 2.5);
      larguraTotal += info.x + 2.5;
    }
    const z = i === 0 ? 0 : -info.z * 0.15;
    const v = o.variante && info.variantes.includes(o.variante) ? { variante: o.variante } : {};
    objetos.push({ id: `o${i}`, asset: o.asset, pos: [r2(x), 0, r2(z)], ...(veiculo ? { giro: i % 2 ? -60 : 60 } : {}), ...v });
    frente = Math.max(frente, z + info.z / 2);
  });
  const gx = larguraTotal / 2 + 6;
  decor.forEach((o, i) => {
    const lado = i % 2 ? 1 : -1;
    objetos.push({ id: `d${i}`, asset: o.asset, pos: [r2(lado * (gx + i * 1.5)), 0, r2(-3 + (i % 3) * 2.5)], params: o.asset.startsWith('arv') || o.asset === 'palmeira' || o.asset === 'arbusto' ? { seed: idx * 7 + i + 1 } : undefined });
  });
  if (!decor.some((o) => /arvore|palmeira/.test(o.asset)) && ['campo', 'floresta', 'litoral'].includes(fundo)) {
    objetos.push({ id: 'dx', asset: fundo === 'litoral' ? 'palmeira' : 'arvore_redonda', pos: [r2(-gx - 1), 0, -4], params: { seed: idx * 3 + 2 } });
  }
  return { objetos: objetos.map((o) => (o.params === undefined ? Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'params')) : o)), frente, larguraTotal, principal: POR_ID[principais[0].asset] };
}

function montarPersonagens(cena, ini, fim, frente, larguraTotal) {
  const specs = (cena.personagens?.length ? cena.personagens : [{ preset: 'apresentador', fala: true }]).slice(0, 2);
  if (!specs.some((s) => s.fala)) specs[0].fala = true;
  const zc = Math.max(4.5, frente + 3.5);
  const dur = Math.max(0.5, fim - ini);
  return specs.map((s, i) => {
    const base = s.preset === 'apresentador' || !catalogo.personagens.some((p) => p.id === s.preset) ? APRESENTADOR : { preset: s.preset };
    const x = specs.length === 1 ? (cena.lado === 'esquerda' ? -2.2 : cena.lado === 'direita' ? 2.2 : 0) : i === 0 ? -1.5 : 1.5;
    const acao = pick(s.acao, ACOES, 'talk');
    const expr = pick(s.expressao, EXPRESSOES, 'neutral');
    const ch = { id: `c${i}`, ...base, pos: [r2(x), 0, r2(zc)], giro: 0, viraPara: [{ em: ini, alvo: 'camera' }], acoes: [] };
    const falaCamada = (mascara) => ({ clip: 'talk', de: ini, ate: fim, fala: true, camada: 1, mascara, expressao: expr });
    if (acao === 'walk' || acao === 'run') {
      const vel = acao === 'walk' ? 0.943 : 2.781;
      const d = Math.min(vel * dur * 0.85, acao === 'walk' ? 6 : 14);
      const sentido = x <= 0 ? 1 : -1;
      ch.pos = [r2(x - sentido * d / 2), 0, r2(zc)];
      ch.viraPara = [{ em: ini, alvo: 'camera' }];
      ch.movimentos = [{ de: ini + 0.2, ate: fim - 0.1, para: [r2(x + sentido * d / 2), r2(zc)], clip: acao }];
      if (s.fala) ch.acoes.push(falaCamada(['head', 'face']));
    } else if (!s.fala) {
      ch.acoes.push({ clip: acao === 'talk' ? 'idle' : acao, de: ini, ate: fim, expressao: expr });
    } else if (acao === 'talk' || acao === 'idle') {
      ch.acoes.push({ clip: 'talk', de: ini, ate: fim, fala: true, expressao: expr });
    } else if (acao === 'point' || acao === 'wave') {
      ch.acoes.push({ clip: acao, de: ini + 0.3, ate: fim, params: acao === 'point' ? { side: 'R', dir: 'forward' } : { side: 'R' } });
      ch.acoes.push(falaCamada(['head', 'face', 'armL']));
    } else {
      ch.acoes.push({ clip: acao, de: ini, ate: fim, expressao: expr });
      ch.acoes.push(falaCamada(['face']));
    }
    return ch;
  });
}

function montarCamera(cena, idx, objetos, personagens) {
  const plano = pick(cena.camera?.plano, PLANOS, idx % 3 === 1 ? 'medio' : 'geral');
  const falante = personagens.find((p) => p.acoes.some((a) => a.fala)) || personagens[0];
  const sinal = idx % 2 ? -1 : 1;
  if (plano === 'geral' || plano === 'topo') {
    return { tipo: 'enquadrar', alvo: 'o0', plano, angulo: sinal * (22 + (idx % 3) * 8), elevacao: plano === 'topo' ? 55 : 16 + (idx % 3) * 6, deriva: -sinal * 16 };
  }
  return { tipo: 'enquadrar', alvo: falante.id, plano, angulo: sinal * 12, elevacao: 7, aproxima: plano === 'close' ? 0.75 : 0.85 };
}

/**
 * @param {object} o
 * @param {object} o.roteiro   saída da IA: { titulo, gancho, perguntaFinal, cenas:[{fala, fundo, horario, cenario:[{asset,variante}], personagens:[{preset,acao,expressao,fala}], camera:{plano}, destaque, fluxo:{material}}] }
 * @param {number[][]} o.marcas  [inicio, fim] real (s) da fala de cada cena (vem da síntese de voz)
 * @param {number} o.duracaoAudio
 * @param {{largura:number,altura:number,fps:number}} o.formato
 */
export function compilarStoryboard({ roteiro, marcas, duracaoAudio, formato }) {
  const cenasIn = roteiro.cenas;
  if (!cenasIn?.length || marcas.length !== cenasIn.length) throw new Error('Roteiro e narração não têm o mesmo número de cenas.');
  const duracao = r2(duracaoAudio + 0.8);
  const palavras = [];
  const cenas = [];
  let fundoGlobal = pick(cenasIn[0].fundo, FUNDOS, 'campo');
  cenasIn.forEach((c, i) => {
    const ini = i === 0 ? 0 : r2(marcas[i][0] - 0.05);
    const fim = i === cenasIn.length - 1 ? duracao : r2(marcas[i + 1][0] - 0.05);
    palavras.push(...palavrasDeCena(c.fala, marcas[i][0], marcas[i][1]));
    const fundo = pick(c.fundo, FUNDOS, fundoGlobal);
    fundoGlobal = fundo;
    const { objetos, frente, larguraTotal, principal } = montarObjetos(c, i, fundo);
    const personagens = montarPersonagens(c, ini, fim, frente, larguraTotal);
    const cena = {
      inicio: ini, fim, ...(i > 0 ? { transicao: 'flash' } : {}),
      ambiente: { fundo, horario: pick(c.horario, HORARIOS, 'dia'), chao: CHAO_POR_FUNDO[fundo] },
      objetos, personagens, camera: montarCamera(c, i, objetos, personagens), textos: [],
    };
    if (i === 0 && roteiro.gancho) cena.textos.push({ texto: String(roteiro.gancho).slice(0, 60).toUpperCase(), de: 0.2, ate: Math.max(1.5, fim - 0.3), estilo: 'titulo' });
    if (c.destaque && i > 0 && i < cenasIn.length - 1) cena.textos.push({ texto: String(c.destaque).slice(0, 32).toUpperCase(), de: r2(ini + 0.4), ate: r2(fim - 0.2), estilo: 'destaque' });
    if (i === cenasIn.length - 1 && roteiro.perguntaFinal) cena.textos.push({ texto: String(roteiro.perguntaFinal).slice(0, 80), de: r2(ini + 0.3), ate: duracao - 0.1, estilo: 'pergunta' });
    // processo animado: material saindo do objeto principal em direção à frente da cena
    const mat = pick(c.fluxo?.material, MATERIAIS, null);
    if (mat) {
      const alt = principal.y * (['fumaca', 'vapor', 'fogo', 'fagulha', 'luz'].includes(mat) ? 0.9 : 0.8);
      cena.fluxos = [{ material: mat, origem: { ancora: 'o0', desloca: [0, r2(alt), 0] }, destino: [r2(Math.min(3, principal.x / 2)), 0.4, r2(frente + 1)], taxa: 40, de: r2(ini + 0.5), ate: r2(fim - 0.2), dispersao: 0.3, espalha: 0.8 }];
    }
    cenas.push(cena);
  });
  const storyboard = {
    versao: 1,
    titulo: roteiro.titulo || 'Vídeo',
    formato: { largura: formato.largura, altura: formato.altura, fps: formato.fps || 30 },
    duracao,
    legendas: { ativo: true, palavrasPorBloco: 3, corDestaque: '#ffd60a', ...(formato.largura > formato.altura ? { posicaoY: 0.8, tamanho: 0.8 } : {}) },
    ambiente: { horario: 'dia', chao: CHAO_POR_FUNDO[fundoGlobal], fundo: fundoGlobal },
    cenas,
  };
  const erros = validarStoryboard(storyboard);
  if (erros.length) throw new Error(`Storyboard inválido: ${erros.slice(0, 4).join('; ')}`);
  return { storyboard, palavras };
}

/** Conferência estrutural (o validador completo do kit roda nos testes: tools/validar.mjs). */
export function validarStoryboard(sb) {
  const e = [];
  if (!(sb.duracao > 0)) e.push('duracao inválida');
  let t = 0;
  sb.cenas.forEach((c, i) => {
    if (Math.abs(c.inicio - t) > 0.011) e.push(`cena ${i + 1} começa em ${c.inicio}, esperado ${t}`);
    if (!(c.fim > c.inicio)) e.push(`cena ${i + 1} sem duração`);
    t = c.fim;
    const ids = new Set();
    for (const o of c.objetos) {
      if (!POR_ID[o.asset]) e.push(`asset inexistente: ${o.asset}`);
      ids.add(o.id);
    }
    for (const p of c.personagens) {
      ids.add(p.id);
      if (!catalogo.personagens.some((x) => x.id === p.preset)) e.push(`personagem inexistente: ${p.preset}`);
      for (const a of p.acoes) if (!catalogo.clips.some((k) => k.id === a.clip)) e.push(`animação inexistente: ${a.clip}`);
    }
    if (!ids.has(c.camera.alvo)) e.push(`câmera da cena ${i + 1} aponta para id inexistente`);
  });
  if (Math.abs(t - sb.duracao) > 0.011) e.push('as cenas não cobrem a duração inteira');
  return e;
}

export { catalogo };
