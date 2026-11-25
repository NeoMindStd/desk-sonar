import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG } from "./dsp.mjs";

export function evaluate(trials, calibrationSession, testSession) {
  if (!calibrationSession || !testSession || calibrationSession === testSession)
    throw new Error("Use distinct calibration and test session IDs.");
  const classes = ["down","up"];
  const valid = t => t?.schema === 1 && t.contextSampleRate === CONFIG.sampleRate
    && Number.isInteger(t.noInputFrames) && t.noInputFrames >= 0
    && Number.isFinite(t.diagnostics?.matchedPeak) && Number.isFinite(t.diagnostics?.clippedFraction)
    && t.diagnostics?.profile?.length === CONFIG.delayMs/CONFIG.binMs
    && t.diagnostics.profile.every(x => Number.isFinite(x) && x >= 0)
    && Object.entries(CONFIG).every(([k,v]) => t.probe?.[k] === v);
  const all = trials.filter(t => [calibrationSession,testSession].includes(t?.session));
  if (!all.every(valid)) throw new Error("Incompatible capture metadata in selected session.");
  const silentPeaks = all.filter(t => t.session === calibrationSession && t.mode === "silent"
    && t.noInputFrames === 0 && t.diagnostics.clippedFraction < .005)
    .map(t => t.diagnostics.matchedPeak);
  if (silentPeaks.length < 2) throw new Error("Calibration needs at least two clean silent controls.");
  const signalFloor = Math.max(.00003, 4*Math.max(...silentPeaks));
  const usable = t => t.noInputFrames === 0 && t.diagnostics.clippedFraction < .005
    && t.diagnostics.matchedPeak >= signalFloor;
  const profile = t => t.diagnostics.profile.map(x => x / t.diagnostics.matchedPeak);
  const dist = (x,y) => Math.sqrt(x.reduce((a,v,i) => a+(v-y[i])**2,0));
  const fit = Object.fromEntries(classes.map(label => {
    const rows = all.filter(t => t.session === calibrationSession && t.mode === "active"
      && t.label === label && usable(t)).map(profile);
    if (rows.length < 2) throw new Error("Calibration needs at least two usable active captures per label.");
    const center = rows[0].map((_,i) => rows.reduce((s,r) => s+r[i],0)/rows.length);
    return [label, {center, spread:Math.max(.05,...rows.map(x => dist(x,center)))}];
  }));
  const test = all.filter(t => t.session === testSession && t.mode === "active"
    && [...classes,"negative"].includes(t.label));
  if (!classes.every(label => test.some(t => t.label === label)))
    throw new Error("Test needs at least one active capture per foot state.");
  const confusion = Object.fromEntries([...classes,"negative"].map(label => [label,{down:0,up:0,unknown:0}]));
  for (const t of test) {
    let prediction = "unknown";
    if (usable(t)) {
      const [first, second] = classes.map(label => ({label,d:dist(profile(t),fit[label].center)}))
        .sort((a,b) => a.d-b.d);
      if (first.d <= 2*fit[first.label].spread && first.d < second.d*.8) prediction = first.label;
    }
    confusion[t.label][prediction]++;
  }
  return {calibrationSession,testSession,signalFloor,testClips:test.length,confusion,
    note:"Experimental clip-level baseline; not event F1, tracking accuracy, or end-to-end latency."};
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  try {
    const [dir,cal,test] = process.argv.slice(2);
    if (!dir) throw new Error("Usage: node bench/evaluate.mjs <capture-dir> <cal-session> <test-session>");
    const names = (await readdir(dir)).filter(n => n.endsWith(".json"));
    const trials = await Promise.all(names.map(async n => JSON.parse(await readFile(join(dir,n),"utf8"))));
    console.log(JSON.stringify(evaluate(trials,cal,test),null,2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}