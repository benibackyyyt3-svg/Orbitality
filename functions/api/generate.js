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
    const format = ["16:9", "9:16", "1:1"].includes(input.format) ? input.format : "16:9";
    const prompt = `Crie um roteiro audiovisual em português brasileiro sobre: ${topic}.
Formato: ${format}. Duração: ${shortsAuto ? "30 a 180 segundos; escolha o tempo adequado e informe duration_seconds" : "600 segundos (10 minutos)"}.
Personagem fixo em todas as cenas: homem pardo adulto, cabelo tigela arredondado, camiseta laranja lisa e calça jeans azul. Não altere sua aparência.
Crie ${shortsAuto ? "3 ou 4" : "5 ou 6"} cenas concisas, com cenários e objetos variados. Cada cena deve ter título, visual, ação, câmera, narração curta e props.
Crie SEO coerente com o roteiro: título YouTube atraente sem clickbait, descrição natural com palavras-chave e hashtags no final, 10 a 15 tags, palavra-chave principal e até 5 secundárias. Em Shorts, chapters deve ser [].
Retorne somente JSON válido neste formato:
{"title":"...","synopsis":"...","main_character":"...","audio_direction":"...","duration_seconds":90,"scenes":[{"title":"...","visual":"...","action":"...","camera":"...","narration":"...","props":["..."]}],"seo":{"youtube_title":"...","description":"...","tags":["..."],"hashtags":["#..."],"primary_keyword":"...","secondary_keywords":["..."],"chapters":[{"time":"00:00","title":"..."}]}}
Não inclua markdown nem texto fora do JSON.`;

    // Flash-Lite is selected for lower latency and smaller outputs, reducing timeout risk.
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      const message = payload.error?.message || "Erro na API Gemini.";
      return Response.json(
        { error: message, source: "gemini", status: response.status },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const raw = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");
    if (!raw) {
      throw new Error("A IA não retornou conteúdo. Tente novamente.");
    }

    const clean = raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const result = JSON.parse(clean);
    if (!Array.isArray(result.scenes) || !result.scenes.length) {
      throw new Error("A IA retornou um roteiro sem cenas. Tente novamente.");
    }

    return Response.json({
      ...result,
      duration: shortsAuto ? Math.min(180, Math.max(30, Number(result.duration_seconds) || 90)) : 600,
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
