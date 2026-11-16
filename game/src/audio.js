// KITEWARDEN — procedural sound. No audio files: every sound is a small
// WebAudio patch (oscillator blips, filtered noise, a wind loop whose gain
// follows the wind). The context is created on the first user gesture, and
// M mutes everything.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.muted = false;
  }

  // Call from a user gesture (click / key). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Wind loop: looping noise through a low-pass filter.
      const len = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0;
      noise.connect(filter);
      filter.connect(this.windGain);
      this.windGain.connect(this.master);
      noise.start();
    } catch {
      this.ctx = null;
    }
  }

  setWind(strength) {
    if (!this.ctx || !this.windGain) return;
    const target = this.muted ? 0 : 0.02 + strength * 0.06;
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; a failure must never break the game.
    }
  }

  noiseBurst(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = freq || 800;
      const gain = this.ctx.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // Audio is decoration; a failure must never break the game.
    }
  }

  shoot(kind) {
    if (kind === 'rod') this.noiseBurst(0.12, 0.12, 2000);
    else if (kind === 'fan') this.noiseBurst(0.08, 0.07, 600);
    else this.blip(660 + Math.random() * 120, 0.07, 'triangle', 0.08, 330);
  }

  kill(boss) {
    if (boss) {
      this.blip(90, 0.5, 'sawtooth', 0.2, 40);
      this.noiseBurst(0.4, 0.25, 300);
    } else {
      this.blip(520, 0.09, 'sine', 0.1, 780);
    }
  }

  leak() {
    this.blip(220, 0.25, 'sawtooth', 0.16, 110);
  }

  waveClear() {
    this.blip(523, 0.12, 'sine', 0.12);
    setTimeout(() => this.blip(659, 0.12, 'sine', 0.12), 110);
    setTimeout(() => this.blip(784, 0.2, 'sine', 0.14), 220);
  }

  click() {
    this.blip(880, 0.05, 'sine', 0.08);
  }

  // Turning a wind vane: a bright two-note chime, up a fourth — the
  // wind itself changing direction, in miniature.
  vaneClick() {
    this.blip(880, 0.07, 'triangle', 0.12, 1174);
    setTimeout(() => this.blip(1174, 0.09, 'triangle', 0.1), 70);
  }

  build() {
    this.blip(392, 0.1, 'triangle', 0.12, 523);
  }
}
