import { CONFIG, summarize, packWav } from "./dsp.mjs";

const $ = id => document.getElementById(id);
const start = $("start"), stop = $("stop"), status = $("status"), result = $("result");
let current, urls = [];
function clearResults() {
  for (const url of urls) URL.revokeObjectURL(url);
  urls = [];
  $("downloads").replaceChildren();
  result.hidden = true;
}
function link(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  urls.push(url);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.textContent = name;
  $("downloads").append(a, document.createElement("br"));
}
async function close(run) {
  clearTimeout(run.timer);
  run.node?.disconnect();
  run.input?.disconnect();
  run.stream?.getTracks().forEach(t => t.stop());
  if (run.ctx && run.ctx.state !== "closed") await run.ctx.close();
}
function resetButtons() { start.disabled = false; stop.disabled = true; }

start.onclick = async () => {
  if (current || !$("session").reportValidity()) return;
  if (!/^[A-Za-z0-9_-]+$/.test($("session").value)) {
    status.textContent = "세션 ID는 영문, 숫자, - 또는 _만 허용합니다."; return;
  }
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = "마이크 사용에는 localhost 또는 HTTPS가 필요합니다."; return;
  }
  clearResults();
  const run = {
    session:$("session").value, label:$("label").value, mode:$("mode").value,
    stamp:new Date().toISOString(),
  };
  current = run; start.disabled = true; stop.disabled = false;
  status.textContent = "마이크 권한 확인 중…";
  try {
    run.ctx = new AudioContext({sampleRate:CONFIG.sampleRate});
    await run.ctx.resume();
    if (current !== run) return close(run);
    if (run.ctx.sampleRate !== CONFIG.sampleRate) throw new Error("48 kHz AudioContext unavailable.");
    run.stream = await navigator.mediaDevices.getUserMedia({audio:{
      channelCount:{ideal:1}, echoCancellation:false, noiseSuppression:false, autoGainControl:false,
    }});
    if (current !== run) return close(run);
    await run.ctx.audioWorklet.addModule("./worklet.mjs");
    if (current !== run) return close(run);
    const {sampleRate, channelCount, echoCancellation, noiseSuppression, autoGainControl}
      = run.stream.getAudioTracks()[0].getSettings();
    run.node = new AudioWorkletNode(run.ctx,"desk-sonar-recorder",{
      channelCount:1, channelCountMode:"explicit", outputChannelCount:[1],
      processorOptions:{active:run.mode === "active"},
    });
    run.node.onprocessorerror = () => fail(run, "오디오 처리 오류. 탭을 새로 열고 다시 시도하세요.");
    run.node.port.onmessage = async ({data}) => {
      if (current !== run) return;
      clearTimeout(run.timer);
      status.textContent = "녹음 끝. 로컬에서 진단 중…";
      try {
        await close(run);
        if (current !== run) return;
        const rate = run.ctx.sampleRate;
        const diagnostics = summarize(data.samples,rate);
        const stem = [run.session,run.label,run.mode,run.stamp.replace(/[:.]/g,"-")].join("_");
        const meta = {schema:1, session:run.session, label:run.label, mode:run.mode,
          recordedAt:run.stamp, contextSampleRate:rate, probe:CONFIG,
          inputSettings:{sampleRate, channelCount, echoCancellation, noiseSuppression, autoGainControl},
          noInputFrames:data.noInputFrames, diagnostics};
        link(stem+".wav",packWav(data.samples,rate),"audio/wav");
        link(stem+".json",JSON.stringify(meta,null,2),"application/json");
        result.hidden = false;
        result.textContent = JSON.stringify({...diagnostics, profile:undefined, noInputFrames:data.noInputFrames},null,2);
        status.textContent = "완료. 아래 WAV와 JSON을 함께 저장하세요. 이 값은 발 위치가 아니라 신호 진단입니다.";
      } catch (err) { status.textContent = err.message; }
      finally { if (current === run) { current = undefined; resetButtons(); } }
    };
    run.input = run.ctx.createMediaStreamSource(run.stream);
    run.input.connect(run.node).connect(run.ctx.destination);
    run.timer = setTimeout(() => fail(run,"녹음 완료 신호가 없습니다. 탭을 전면에 두고 다시 시도하세요."),12000);
    status.textContent = "6초 측정 중. 선택한 발 상태를 유지하세요.";
  } catch (err) { await fail(run, err.message); }
};

async function fail(run, message) {
  if (current !== run) return;
  current = undefined;
  try { await close(run); }
  finally {
    if (!current) { status.textContent = message; resetButtons(); }
  }
}
stop.onclick = () => { if (current) void fail(current,"중지했습니다. 부분 녹음은 저장하지 않았습니다."); };
addEventListener("pagehide", () => {
  const run = current; current = undefined;
  if (run) void close(run);
  clearResults();
});