import { CONFIG, makeProbe, samplesFor } from "./dsp.mjs";

class Recorder extends AudioWorkletProcessor {
  constructor({processorOptions}) {
    super();
    this.probe = makeProbe(sampleRate);
    this.period = samplesFor(sampleRate, CONFIG.periodMs);
    this.lead = samplesFor(sampleRate, CONFIG.leadMs);
    this.active = processorOptions.active === true;
    this.data = new Float32Array(sampleRate * CONFIG.seconds);
    this.i = 0;
    this.noInputFrames = 0;
  }

  process(inputs, outputs) {
    if (this.done) return false;
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;
    for (let j = 0; j < output.length && this.i < this.data.length; j++, this.i++) {
      if (!input) this.noInputFrames++;
      this.data[this.i] = input?.[j] ?? 0;
      const phase = this.i >= this.lead ? (this.i-this.lead) % this.period : -1;
      output[j] = this.active && phase >= 0 && phase < this.probe.length
        ? CONFIG.amplitude * this.probe[phase] : 0;
    }
    if (this.i !== this.data.length) return true;
    this.done = true;
    this.port.postMessage({samples:this.data, noInputFrames:this.noInputFrames}, [this.data.buffer]);
    return false;
  }
}

registerProcessor("desk-sonar-recorder", Recorder);