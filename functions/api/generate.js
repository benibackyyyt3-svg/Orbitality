export async function onRequestPost({ request, env }) {
  try {
    if (!env.GEMINI_API_KEY) {
      return Response.json(
        { error: "Configure GEMINI_API_KEY nos secrets do Cloudflare Pages." },
        { status: 503 }
      );
    }

    const input = await request.json();
    const topic = String(input.topic || "").trim().slice(0, 1200);

    if (!topic) {
      return Response.json({ error: "Informe o tema do vídeo." }, { status: 400 });
    }

    const duration = Math.max(15, Math.min(180, Number(input.duration) || 30));
    const format = ["16:9", "9:16", "1:1"].includes(input.format)
      ? input.format
      : "16:9";

    const prompt = `Crie um plano original de produção audiovisual em português brasileiro.
Tema: ${topic}.
Duração: ${duration} segundos.
Formato: ${format}.
Personagem principal obrigatório e consistente: homem pardo adulto, cabelo tigela arredondado, camiseta laranja lisa e calça jeans azul.
Não mude rosto, cabelo, roupa ou proporções entre cenas.
Crie entre 3 e 8 cenas com cenários, iluminação e objetos específicos diferentes e coerentes com a história.
Não repita o mesmo cenário nem o mesmo conjunto de objetos.
Inclua narração curta em português brasileiro, ações visualmente filmáveis e instruções de câmera.
Retorne SOMENTE JSON válido com este formato:
{"title":"...","synopsis":"...","main_character":"...","audio_direction":"...","scenes":[{"title":"...","visual":"...","action":"...","camera":"...","narration":"...","props":["..."]}]}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: payload.error?.message || "Erro na API Gemini." },
        { status: 502 }
      );
    }

    const raw = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");

    if (!raw) {
      throw new Error("A IA não retornou conteúdo.");
    }

    const clean = raw.trim().replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/, "");
    const result = JSON.parse(clean);

    return Response.json({
      ...result,
      duration,
      format,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Erro interno ao gerar o roteiro." },
      { status: 500 }
    );
  }
}
