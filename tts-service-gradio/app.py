"""Serviço de voz do Video Factory para Hugging Face Spaces (tipo Gradio, grátis).
POST /tts {"frases":[...], "voz":"pm_alex", "velocidade":1.0} -> audio/wav + cabeçalho X-Marcas. GET /saude."""
import io, json, os, re, threading, urllib.request, wave
import numpy as np
import gradio as gr
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from kokoro_onnx import Kokoro

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.join(AQUI, "modelos"); os.makedirs(PASTA, exist_ok=True)
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
for nome in ("kokoro-v1.0.int8.onnx", "voices-v1.0.bin"):
    destino = os.path.join(PASTA, nome)
    if not os.path.exists(destino):
        urllib.request.urlretrieve(BASE + nome, destino)

kokoro = Kokoro(os.path.join(PASTA, "kokoro-v1.0.int8.onnx"), os.path.join(PASTA, "voices-v1.0.bin"))
extra = {a[:-4]: np.load(os.path.join(AQUI, a)).astype(np.float32) for a in os.listdir(AQUI) if a.endswith(".npy")}
PADRAO = "pm_alex" if "pm_alex" in extra else "pf_dora"
trava = threading.Lock()
SR, PAUSA = 24000, 0.22


def dividir(f, lim=260):
    if len(f) <= lim:
        return [f]
    out, at = [], ""
    for p in re.split(r"(?<=[,;:])\s+", f):
        if at and len(at) + len(p) > lim:
            out.append(at.strip()); at = ""
        at += p + " "
    return out + ([at.strip()] if at.strip() else [])


def sintetizar(frases, voz, vel):
    estilo = extra.get(voz, voz)
    partes, marcas, t = [], [], 0.0
    with trava:
        for fr in frases:
            ini = t
            for pc in dividir(fr):
                a, sr = kokoro.create(pc, voice=estilo, speed=vel, lang="pt-br")
                partes.append(a.astype(np.float32)); t += len(a) / sr
            marcas.append([round(ini, 3), round(t, 3)])
            z = np.zeros(int(SR * PAUSA), dtype=np.float32); partes.append(z); t += len(z) / SR
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(np.concatenate(partes), -1, 1) * 32767).astype(np.int16).tobytes())
    return buf.getvalue(), marcas


api = FastAPI()
api.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Marcas"])


@api.get("/saude")
def saude():
    return {"ok": True, "vozPadrao": PADRAO}


@api.post("/tts")
async def tts(req: Request):
    try:
        d = await req.json()
        frases = [str(f).strip() for f in d.get("frases", []) if str(f).strip()]
        if not frases or sum(map(len, frases)) > 6000:
            return JSONResponse({"erro": "Envie de 1 a ~6000 caracteres em 'frases'."}, 400)
        wav, marcas = sintetizar(frases, str(d.get("voz") or PADRAO), min(1.3, max(0.7, float(d.get("velocidade") or 1))))
        return Response(wav, media_type="audio/wav", headers={"X-Marcas": json.dumps(marcas)})
    except KeyError as e:
        return JSONResponse({"erro": f"Voz inexistente: {e}"}, 400)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"erro": f"Falha na síntese: {e}"}, 500)


with gr.Blocks() as demo:
    gr.Markdown("Serviço de voz do Video Factory. Endpoints: POST /tts e GET /saude.")

app = gr.mount_gradio_app(api, demo, path="/")
