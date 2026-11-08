# Video Factory AI — como publicar (3 passos, ~10 min, R$ 0)

1. **Site (Cloudflare Pages):** copie `video-factory/` e `functions/` para a raiz do repositório Orbitality e faça commit.
   O Pages publica sozinho. A página fica em `/video-factory/`.
2. **Gemini:** em Cloudflare Pages → Settings → Environment variables, crie `GEMINI_API_KEY` (chave grátis em aistudio.google.com).
3. **Voz (Hugging Face Spaces, grátis):** crie um Space tipo *Docker*, suba o conteúdo de `tts-service/`.
   Depois escreva a URL dele em `video-factory/config.js` (`ttsUrl`).
