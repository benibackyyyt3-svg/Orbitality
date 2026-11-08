// Cloudflare Pages Function: POST /api/roteiro  { tema, duracao (s) }  ->  roteiro JSON (só assets que existem no pacote).
// A chave fica em variável de ambiente GEMINI_API_KEY (nunca vai para o navegador).
import catalogo from '../../video-factory/roteiro/catalogo.js';

const FUNDOS = ['campo', 'cidade', 'floresta', 'deserto', 'litoral', 'industrial', 'interior'];
const ACOES = ['talk', 'point', 'wave', 'think', 'cheer', 'surprised', 'shrug', 'nod', 'shake_head', 'look_around', 'hammer', 'dig', 'carry', 'push', 'crouch', 'read_clipboard', 'walk', 'run', 'idle'];
const MATERIAIS = ['pedra', 'brita', 'areia', 'terra', 'concreto', 'asfalto', 'agua', 'fumaca', 'vapor', 'poeira', 'ar', 'bolha', 'neve', 'eletricidade', 'luz', 'fagulha', 'fogo'];
const ASSETS = catalogo.cenario.map((a) => a.id);
const PERSONAGENS = ['apresentador', ...catalogo.personagens.map((p) => p.id)];

const schema = {
  type: 'OBJECT',
  required: ['titulo', 'gancho', 'perguntaFinal', 'cenas'],
  properties: {
    titulo: { type: 'STRING' }, gancho: { type: 'STRING' }, perguntaFinal: { type: 'STRING' },
    cenas: { type: 'ARRAY', items: { type: 'OBJECT', required: ['fala', 'fundo', 'cenario', 'personagens', 'camera'], properties: {
      fala: { type: 'STRING' },
      fundo: { type: 'STRING', enum: FUNDOS },
      horario: { type: 'STRING', enum: ['dia', 'tarde', 'nublado'] },
      cenario: { type: 'ARRAY', items: { type: 'OBJECT', required: ['asset'], properties: { asset: { type: 'STRING', enum: ASSETS }, variante: { type: 'STRING' } } } },
      personagens: { type: 'ARRAY', items: { type: 'OBJECT', required: ['preset', 'acao'], properties: {
        preset: { type: 'STRING', enum: PERSONAGENS }, acao: { type: 'STRING', enum: ACOES },
        expressao: { type: 'STRING', enum: catalogo.expressoes }, fala: { type: 'BOOLEAN' } } } },
      camera: { type: 'OBJECT', required: ['plano'], properties: { plano: { type: 'STRING', enum: ['geral', 'medio', 'close', 'topo'] } } },
      destaque: { type: 'STRING' },
      fluxo: { type: 'OBJECT', properties: { material: { type: 'STRING', enum: MATERIAIS } } },
    } } },
  },
};

const lista = catalogo.cenario.map((a) => `${a.id} [${a.cat}]${a.variantes.length ? ` variantes: ${a.variantes.join('/')}` : ''} — ${a.desc}`).join('\n');

function prompt(tema, nCenas, palavras) {
  return `Você é roteirista de vídeos curtos educativos em animação 3D (estilo Shorts/Reels), em português do Brasil.
TEMA: "${tema}"
Escreva um roteiro com EXATAMENTE ${nCenas} cenas e cerca de ${palavras} palavras faladas no total (cada cena tem 1 a 2 frases curtas, 12 a 30 palavras).
Regras:
- Fatos corretos, sem inventar. Linguagem simples, natural e falada. Sem jargão. Números por extenso nas falas.
- Cena 1 = gancho que prende (pergunta ou crença errada). Última cena = fecha o gancho. "perguntaFinal" = pergunta fácil de comentar (até 60 caracteres). "gancho" = frase curta de título (até 45 caracteres).
- Cada cena mostra algo ACONTECENDO. Escolha "cenario" (1 a 3 objetos principais + até 3 de decoração) SOMENTE da lista abaixo, relacionados ao assunto da cena. Use "fluxo" (material) quando houver processo (água, fumaça, areia...). Varie cenários, fundos e câmeras entre as cenas.
- "personagens": 1 ou 2 por cena; exatamente um com fala=true (quem narra). O narrador padrão é "apresentador". Escolha a "acao" que combine com a fala. "destaque" = rótulo curto (até 30 caracteres) com um número ou ideia-chave, opcional.
Objetos disponíveis:
${lista}`;
}

export async function onRequestPost({ request, env }) {
  const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' };
  const falha = (status, erro) => new Response(JSON.stringify({ erro }), { status, headers: cors });
  if (!env.GEMINI_API_KEY) return falha(500, 'A chave GEMINI_API_KEY não está configurada no Cloudflare Pages (Settings → Environment variables).');
  let corpo;
  try { corpo = await request.json(); } catch { return falha(400, 'Pedido inválido.'); }
  const tema = String(corpo.tema || '').trim().slice(0, 300);
  const dur = Math.min(120, Math.max(15, Number(corpo.duracao) || 45));
  if (tema.length < 3) return falha(400, 'Escreva o assunto do vídeo.');
  const nCenas = Math.max(4, Math.min(16, Math.round(dur / 6)));
  const palavras = Math.round(dur * 2.5);
  const modelo = env.GEMINI_MODEL || 'gemini-2.5-flash';
  let ultimoErro = 'desconhecido';
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt(tema, nCenas, palavras) }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.8 } }),
    });
    if (!r.ok) { ultimoErro = `Gemini respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`; if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 1500 * (tentativa + 1))); continue; } break; }
    try {
      const j = await r.json();
      const roteiro = JSON.parse(j.candidates[0].content.parts[0].text);
      if (!roteiro.cenas?.length) throw new Error('sem cenas');
      return new Response(JSON.stringify(roteiro), { headers: cors });
    } catch (e) { ultimoErro = `resposta inválida do Gemini (${e.message})`; }
  }
  return falha(502, `Não consegui gerar o roteiro: ${ultimoErro}`);
}
export const onRequestOptions = () => new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
