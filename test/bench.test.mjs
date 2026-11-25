import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, makeProbe, samplesFor, summarize, packWav } from "../bench/dsp.mjs";
import { evaluate } from "../bench/evaluate.mjs";

test("probe alignment, silent control and WAV structure", () => {
  const rate=CONFIG.sampleRate, p=makeProbe(rate), x=new Float32Array(rate*2);
  const delay=samplesFor(rate,17);
  for(let s=samplesFor(rate,CONFIG.leadMs)+delay;s+p.length<x.length;s+=samplesFor(rate,CONFIG.periodMs))
    for(let j=0;j<p.length;j++) x[s+j] += p[j]*.05;
  const active=summarize(x,rate);
  assert.equal(active.peakBinStartMs,16);
  assert.ok(Math.abs(active.matchedPeak-.05)<1e-6);
  assert.equal(summarize(new Float32Array(x.length),rate).matchedPeak,0);
  assert.throws(() => summarize(new Float32Array(200),rate),/complete/);
  const w = new DataView(packWav(new Float32Array([-1,0,1]),rate));
  assert.equal(w.getUint32(24,true),rate);
  assert.equal(w.getUint32(40,true),6);
  assert.equal(w.getInt16(44,true),-32768);
  assert.equal(w.getInt16(48,true),32767);
});

test("worklet emits only in active windows, retains input, completes without recording the speaker directly", async () => {
  let Ctor, posted;
  globalThis.sampleRate=CONFIG.sampleRate;
  globalThis.AudioWorkletProcessor=class { port={postMessage(x) {posted=x;}}; };
  globalThis.registerProcessor=(_,c) => {Ctor=c;};
  await import("../bench/worklet.mjs");
  for(const active of [false,true]) {
    posted=undefined;
    const obj=new Ctor({processorOptions:{active}});
    const output=new Float32Array(128);
    const input=new Float32Array(128).fill(.1);
    let nonZero=false, blocks=0;
    while(true) {
      output.fill(0);
      const keep=obj.process([[input]],[[output]]);
      nonZero ||= output.some(x=>x!==0);
      assert.ok(output.every(x=>Math.abs(x) <= CONFIG.amplitude));
      assert.ok(++blocks <= 2300);
      if(!keep) break;
    }
    assert.equal(nonZero,active);
    assert.equal(posted.samples.length,CONFIG.sampleRate*CONFIG.seconds);
    assert.ok(posted.samples.every(x=>Math.abs(x-.1)<1e-7));
    assert.equal(posted.noInputFrames,0);
  }
});

test("held-out evaluation separates captures and rejects weak/ambiguous readings", () => {
  const sample = (session,label,mode,bin,peak) => ({
    schema:1, session,label,mode, contextSampleRate:CONFIG.sampleRate, probe:CONFIG, noInputFrames:0,
    diagnostics:{matchedPeak:peak,clippedFraction:0,
      profile:Array.from({length:CONFIG.delayMs/CONFIG.binMs},(_,i) => i===bin?peak:0)},
  });
  const trials=[
    sample("a","down","silent",0,.00001),sample("a","up","silent",0,.00001),
    ...[0,1].flatMap(()=>[sample("a","up","active",3,.01),sample("a","down","active",6,.01)]),
    sample("b","up","active",3,.009),sample("b","down","active",6,.009),
    sample("b","negative","active",5,.009),sample("b","down","active",6,0),
  ];
  const report=evaluate(trials,"a","b");
  assert.deepEqual(report.confusion,{down:{down:1,up:0,unknown:1},up:{down:0,up:1,unknown:0},negative:{down:0,up:0,unknown:1}});
  assert.throws(()=>evaluate(trials,"a","a"),/distinct/);
});