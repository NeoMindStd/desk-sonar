export const CONFIG = Object.freeze({
  sampleRate: 48000, seconds: 6, leadMs: 500, periodMs: 250,
  pulseMs: 8, lowHz: 14000, highHz: 18000, amplitude: 0.015,
  delayMs: 120, binMs: 2,
});

export const samplesFor = (rate, ms) => Math.round(rate * ms / 1000);

export function makeProbe(rate) {
  if (rate < 40000) throw new Error("Sample rate below 40 kHz; no signal emitted.");
  const n = samplesFor(rate, CONFIG.pulseMs);
  const probe = new Float32Array(n);
  const slope = (CONFIG.highHz - CONFIG.lowHz) / (n / rate);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const window = (1 - Math.cos(2 * Math.PI * i / (n - 1))) / 2;
    probe[i] = Math.sin(2 * Math.PI * (CONFIG.lowHz * t + slope * t * t / 2)) * window;
  }
  return probe;
}

const median = a => {
  const s = [...a].sort((x,y) => x-y);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i-1] + s[i]) / 2;
};

export function summarize(data, rate) {
  const probe = makeProbe(rate);
  const energy = probe.reduce((sum, x) => sum + x*x, 0);
  const bin = samplesFor(rate, CONFIG.binMs);
  const count = CONFIG.delayMs / CONFIG.binMs;
  const period = samplesFor(rate, CONFIG.periodMs);
  let clipped = 0;
  for (const x of data) if (Math.abs(x) >= .99) clipped++;
  const profiles = [];
  // Adjacent samples are both tested. Decimating lags can miss the carrier peak.
  for (let i = samplesFor(rate, CONFIG.leadMs); i + count*bin + probe.length <= data.length; i += period) {
    const profile = new Array(count).fill(0);
    for (let j = 0; j < count * bin; j++) {
      let dot = 0;
      for (let k = 0; k < probe.length; k++) dot += data[i+j+k] * probe[k];
      const b = Math.floor(j / bin);
      profile[b] = Math.max(profile[b], Math.abs(dot) / energy);
    }
    profiles.push(profile);
  }
  if (profiles.length < 4) throw new Error("Not enough complete probe windows.");
  const profile = Array.from({length:count}, (_, j) => median(profiles.map(p => p[j])));
  const peak = Math.max(...profile);
  const peakBin = profile.indexOf(peak);
  const background = median(profile);
  return {probeWindows:profiles.length, clippedFraction:clipped/data.length,
    matchedPeak:peak, peakBinStartMs:peakBin * CONFIG.binMs,
    peakToMedian:peak / Math.max(background, 1e-8), profile};
}

export function packWav(data, rate) {
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(buffer);
  const id = (i, t) => { for (const ch of t) v.setUint8(i++, ch.charCodeAt(0)); };
  id(0,"RIFF"); v.setUint32(4,buffer.byteLength-8,true);
  id(8,"WAVE"); id(12,"fmt "); v.setUint32(16,16,true);
  v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,rate,true);
  v.setUint32(28,rate*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
  id(36,"data"); v.setUint32(40,data.length*2,true);
  for (let i=0; i<data.length; i++) {
    const x = Math.max(-1, Math.min(1, data[i]));
    v.setInt16(44+i*2, Math.round(x < 0 ? x*32768 : x*32767), true);
  }
  return buffer;
}