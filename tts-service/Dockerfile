# Serviço de voz (Kokoro, pt-BR) — pensado para o Hugging Face Spaces (Docker, grátis, porta 7860).
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir kokoro-onnx soundfile numpy
RUN mkdir -p modelos && \
    curl -L -o modelos/kokoro-v1.0.int8.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx && \
    curl -L -o modelos/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
COPY server.py pm_alex.npy ./
ENV PORT=7860
EXPOSE 7860
CMD ["python", "server.py"]
