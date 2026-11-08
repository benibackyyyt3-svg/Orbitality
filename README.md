# Video Factory AI

Aplicação web instalável (PWA) em português para Android. Gera automaticamente um roteiro/storyboard estruturado com Gemini e permite baixar o plano em JSON.

## Publicar no Cloudflare Pages (gratuito, sujeito aos limites do plano)

1. Entre em https://dash.cloudflare.com/ e abra **Workers & Pages**.
2. Escolha **Create application > Pages > Connect to Git**.
3. Autorize o GitHub, selecione `benibackyyyt3-svg/Orbitality` e a branch `main`.
4. Configure **Framework preset: None** e **Build command: (vazio)**.
5. Configure **Build output directory: /** (raiz do repositório).
6. Crie o projeto e aguarde o primeiro deploy.
7. Em **Settings > Variables and Secrets**, adicione `GEMINI_API_KEY` como secret (não como variável pública, se a interface distinguir).
8. Cole sua chave do Google AI Studio no campo de valor e salve. Nunca coloque a chave no código, em commits, screenshots ou mensagens.
9. Faça um novo deploy para garantir que a Function receba o secret.
10. Abra o domínio `.pages.dev` no Chrome do Android > menu ⋮ > **Adicionar à tela inicial**.

## Como usar

Abra o site, escreva o tema, selecione duração e formato e toque em **Gerar projeto**. O sistema cria título, sinopse, cenas, direção de câmera, objetos e narração. Use **Baixar roteiro JSON** para salvar o plano.

## Segurança

- A chave Gemini é lida exclusivamente no servidor pela variável secreta `GEMINI_API_KEY`.
- A chave é enviada ao Google pelo cabeçalho `x-goog-api-key`, não é embutida no JavaScript público.
- Não compartilhe sua chave nem a publique no GitHub. Se ela for exposta, revogue-a no Google AI Studio e crie outra.

## Limitações da primeira versão

- Esta versão gera roteiro/storyboard; **ainda não renderiza nem entrega MP4**.
- Full HD 1920×1080 é um alvo para uma etapa posterior, não uma capacidade implementada.
- O uso gratuito do Gemini tem limites, sujeitos à conta, modelo e políticas atuais do Google.
- A hospedagem Pages serve o painel e executa a função de roteiro; não é um renderizador 3D de vídeo longo.
- A geração de vídeo final exigirá integrar TTS (por exemplo, Kokoro), criação/consistência de imagens ou cenas 3D, composição, FFmpeg e uma infraestrutura de renderização. Não prometemos processamento ilimitado ou gratuito na nuvem.

## Implementação

- Frontend: HTML/CSS/JavaScript PWA.
- Backend: Cloudflare Pages Function em `functions/api/generate.js`.
- Endpoint: `POST /api/generate`.
- Modelo: Gemini 2.5 Flash (disponibilidade e quotas dependem do Google).
