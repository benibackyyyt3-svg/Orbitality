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

    const shortsAuto = input.duration_mode === "shorts-auto";
    const duration = shortsAuto ? null : 600;
    const format = ["16:9", "9:16", "1:1"].includes(input.format)
      ? input.format
      : "16:9";

    const prompt = `Crie um plano original de produção audiovisual em português brasileiro.
Tema: ${topic}.
Duração: ${shortsAuto ? "Escolha automaticamente o tempo necessário para contar a história, entre 30 e 180 segundos" : "EXATAMENTE 600 segundos (10 minutos)"}.
Formato: ${format}.
Personagem principal obrigatório e consistente: homem pardo adulto, cabelo tigela arredondado, camiseta laranja lisa e calça jeans azul.
Não mude rosto, cabelo, roupa ou proporções entre cenas.
Crie entre 3 e 8 cenas com cenários, iluminação e objetos específicos diferentes e coerentes com a história.
Não repita o mesmo cenário nem o mesmo conjunto de objetos.
Inclua narração curta em português brasileiro, ações visualmente filmáveis e instruções de câmera. O SEO deve corresponder exatamente ao conteúdo criado. Para Shorts, não crie capítulos; para vídeos horizontais de 10 minutos, crie capítulos estimados coerentes com a sequência das cenas.
Retorne SOMENTE JSON válido com este formato:
{"title":"...","synopsis":"...","main_character":"...","audio_direction":"...","scenes":[{"title":"...","visual":"...","action":"...","camera":"...","narration":"...","props":["..."]}]}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
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
      duration: shortsAuto ? (Number(result.duration_seconds) || 90) : 600,
      duration_mode: shortsAuto ? "shorts-auto" : "fixed",
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
