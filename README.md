# Video Factory AI

PWA em português para Android. A primeira versão gera automaticamente roteiro/storyboard estruturado com Gemini e permite baixar o plano em JSON.

## Publicar gratuitamente no Cloudflare Pages

1. Importe este repositório no Cloudflare Pages.
2. Configure o framework como **None** e o diretório de saída como `/`.
3. Adicione a variável secreta `GEMINI_API_KEY` nas configurações do projeto Pages (Settings > Variables and Secrets). Nunca coloque a chave no frontend ou no GitHub.
4. Faça novo deploy.
5. Abra o endereço Pages no Android Chrome e use **Adicionar à tela inicial**.

## Limitações honestas da versão inicial

- Gera roteiro e storyboard; ainda não renderiza MP4.
- Full HD é a meta de exportação futura, não uma função já implementada.
- A API Gemini gratuita tem limites e disponibilidade sujeitos às condições do Google.
- Para vídeo automático serão necessários um renderizador de cenas, TTS e uma infraestrutura de renderização. A renderização 3D pesada não é confiável em hospedagem estática gratuita.

## Desenvolvimento

Cloudflare Pages Functions executa `functions/api/generate.js` no endpoint `POST /api/generate`.