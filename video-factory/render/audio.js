// Áudio do vídeo: narração (AudioBuffer) + música de fundo sintetizada (sem direitos autorais) → mix estéreo 48 kHz.

const SR = 48000;

// Pad ambiente simples: acordes suaves (Am–F–C–G) com envelope lento. 100% gerado em código.
function agendarMusica(ctx, duracao, volume) {
  const mestre = ctx.createGain();
  mestre.gain.value = volume;
  mestre.connect(ctx.destination);
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 1400;
  filtro.connect(mestre);
  const acordes = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]];
  const compasso = 4;
  for (let t = 0, i = 0; t < duracao; t += compasso, i++) {
    for (const f of acordes[i % acordes.length]) {
      for (const det of [-3, 3]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.14, t + 1.2);
        g.gain.linearRampToValueAtTime(0.1, t + compasso - 1);
        g.gain.linearRampToValueAtTime(0, t + compasso + 0.8);
        o.connect(g).connect(filtro);
        o.start(t);
        o.stop(t + compasso + 1);
      }
    }
  }
  // fade-out final
  mestre.gain.setValueAtTime(volume, Math.max(0, duracao - 1.5));
  mestre.gain.linearRampToValueAtTime(0, duracao);
}

export async function mixarAudio({ narracao, duracao, volNarracao = 1, volMusica = 0.12 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duracao * SR), SR);
  if (narracao) {
    const src = ctx.createBufferSource();
    src.buffer = narracao;
    const g = ctx.createGain();
    g.gain.value = volNarracao;
    src.connect(g).connect(ctx.destination); // mono vira estéreo automaticamente; reamostra para 48 kHz
    src.start(0);
  }
  if (volMusica > 0) agendarMusica(ctx, duracao, volMusica);
  return ctx.startRendering();
}
