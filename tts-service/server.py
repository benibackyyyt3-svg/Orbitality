"""Serviço de voz do Video Factory: Kokoro (kokoro-onnx), pt-BR, voz pm_alex do usuário. R$ 0.
POST /tts  {"frases": ["..."], "voz": "pm_alex", "velocidade": 1.0}
  -> audio/wav (mono 24 kHz) + cabeçalho X-Marcas = JSON [[inicio, fim], ...] em segundos, uma marca por frase.
GET  /saude -> {"ok": true}
"""
import io, json, os, re, threading, wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from kokoro_onnx import Kokoro

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELO = os.environ.get("KOKORO_MODEL", os.path.join(AQUI, "modelos", "kokoro-v1.0.int8.onnx"))
VOZES = os.environ.get("KOKORO_VOICES", os.path.join(AQUI, "modelos", "voices-v1.0.bin"))
ORIGENS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
LIMITE_CHARS = 6000
PAUSA_FRASE = 0.22
SR = 24000

kokoro = Kokoro(MODELO, VOZES)
trava = threading.Lock()  # o modelo atende uma síntese por vez
vozes_extra = {}
for arq in os.listdir(AQUI):
    if arq.endswith(".npy"):  # voicepacks do usuário (ex.: pm_alex.npy, formato 510x1x256)
        vozes_extra[arq[:-4]] = np.load(os.path.join(AQUI, arq)).astype(np.float32)
PADRAO = "pm_alex" if "pm_alex" in vozes_extra else "pf_dora"


def dividir(frase, limite=260):
    if len(frase) <= limite:
        return [frase]
    partes, atual = [], ""
    for p in re.split(r"(?<=[,;:])\s+", frase):
        if atual and len(atual) + len(p) > limite:
            partes.append(atual.strip()); atual = ""
        atual += p + " "
    if atual.strip():
        partes.append(atual.strip())
    return partes


def sintetizar(frases, voz, velocidade):
    estilo = vozes_extra.get(voz, voz)
    partes, marcas, t = [], [], 0.0
    with trava:
        for frase in frases:
            ini = t
            for pedaco in dividir(frase):
                amostras, sr = kokoro.create(pedaco, voice=estilo, speed=velocidade, lang="pt-br")
                partes.append(amostras.astype(np.float32)); t += len(amostras) / sr
            marcas.append([round(ini, 3), round(t, 3)])
            pausa = np.zeros(int(SR * PAUSA_FRASE), dtype=np.float32)
            partes.append(pausa); t += len(pausa) / SR
    audio = np.concatenate(partes)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    return buf.getvalue(), marcas


class H(BaseHTTPRequestHandler):
    def _cors(self):
        origem = self.headers.get("Origin", "")
        ok = "*" in ORIGENS or origem in ORIGENS
        self.send_header("Access-Control-Allow-Origin", origem if ok and origem else ("*" if "*" in ORIGENS else ORIGENS[0]))
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Expose-Headers", "X-Marcas")

    def _json(self, code, obj):
        d = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(d)))
        self.end_headers(); self.wfile.write(d)

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if self.path.startswith("/saude"):
            self._json(200, {"ok": True, "vozPadrao": PADRAO, "vozes": sorted(set(list(vozes_extra) + ["pf_dora", "pm_alex", "pm_santa"]))})
        else:
            self._json(404, {"erro": "não encontrado"})

    def do_POST(self):
        if self.path != "/tts":
            return self._json(404, {"erro": "não encontrado"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n) or b"{}")
            frases = [str(f).strip() for f in req.get("frases", []) if str(f).strip()]
            if not frases or sum(map(len, frases)) > LIMITE_CHARS:
                return self._json(400, {"erro": "Envie de 1 a ~6000 caracteres de texto em 'frases'."})
            voz = str(req.get("voz") or PADRAO)
            vel = min(1.3, max(0.7, float(req.get("velocidade") or 1.0)))
            wav, marcas = sintetizar(frases, voz, vel)
        except KeyError as e:
            return self._json(400, {"erro": f"Voz inexistente: {e}"})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"erro": f"Falha na síntese: {e}"})
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "audio/wav"); self.send_header("Content-Length", str(len(wav)))
        self.send_header("X-Marcas", json.dumps(marcas)); self.end_headers(); self.wfile.write(wav)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    porta = int(os.environ.get("PORT", 7860))
    print(f"Voz pronta na porta {porta} (padrão: {PADRAO})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", porta), H).serve_forever()
