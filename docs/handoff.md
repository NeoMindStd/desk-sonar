# 다음 작업: 실폰 검증

현재 구현은 Node 의존성 없는 로컬 웹 기록기와 오프라인 분석기의 첫 버전이다. 발의 정지 상태를 담은 짧은 클립을 모으는 도구이며, 실시간 발 트래킹은 구현하지 않았다. 시뮬레이션과 브라우저 테스트를 실제 발 감지 성공으로 간주하지 않는다.

## 실행

Windows에서 저장소 루트 기준:

```powershell
node --test
node bench/serve.mjs
```

PC에서 http://localhost:8765 를 열면 UI를 확인할 수 있다. 실제 실험은 Android 공기계에서 진행한다. USB 디버깅이 켜진 테스트 폰 하나를 연결한 뒤:

```powershell
adb devices -l
adb reverse tcp:8765 tcp:8765
```

폰의 Chrome에서 **http://localhost:8765** 를 열고, 기기의 미디어 볼륨을 낮춘 후 대조 실험부터 시작한다. 장치에 여러 대 연결되면 `adb -s <serial>`로 명시한다. 종료 후 필요 없다면 `adb reverse --remove tcp:8765`로 해제한다. LAN HTTP 주소는 마이크가 차단될 수 있다. 서버는 루프백에만 연결되며 저장소 전체를 노출하거나 파일 업로드를 받지 않는다. [Chrome USB 포트 포워딩](https://developer.chrome.com/docs/devtools/remote-debugging/local-server) · [브라우저 마이크 요건](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## 수집

- `day1`: 시험음 끈 down/up 대조 각 2회 이상, 시험음 켠 down/up 각 3회 이상, 빈 자리/의자 움직임은 negative로 별도 기록. 6초 동안 정답 자세를 유지한다. WAV와 JSON은 둘 다 저장하고 기종·OS·폰 배치·볼륨을 기록한다. 원본은 저장소 밖 또는 무시되는 data/에만 둔다.
- `day2`: 폰을 다시 설치하고 동일 라벨을 새로 수집한다. 슬리퍼·배경음 변경 조건은 별도 세션으로 보존한다. 같은 클립을 학습과 시험에 쓰지 않는다.
- active에 반복된 반향 피크가 없거나 silent와 구분되지 않으면, 판별기 튜닝 전에 오디오 경로부터 확인한다. 48kHz는 브라우저 컨텍스트의 샘플레이트이고 하드웨어가 그대로 지원한다는 증거가 아니다. 기종별 고주파 응답, 실제 마이크 경로, 신호 대 잡음, 브라우저 오디오 보정을 확인한다. 불편한 소리가 나면 중지한다.
- `node bench/evaluate.mjs data day1 day2` → clip-level 혼동 행렬. 정지 상태 구별 가능성을 확인하는 단계이므로 이 값은 실제 동작 이벤트 F1·실시간 지연과 다르다. 임계값은 검증 전 가설일 뿐이다.

## 후속 구현 순서

1. 실제 폰에서 녹음·재생 동시 동작과 silent 대비 피크를 먼저 검증한다. 적합한 신호가 확인될 때까지 아바타·BLE·양발 구현은 미룬다.
2. 브라우저 계층 한계가 확인되면 Android AudioTrack + AudioRecord로 네이티브 수집기를 만든다. 미지원 시 소스 선택 이유와 장치 적용 효과를 기록하고, 수집 시작/종료를 명시적으로 제어한다. [Android AudioRecord](https://developer.android.com/reference/android/media/AudioRecord)
3. 클립 판별 재현 후 라이브 상태와 unknown, 상태 변화 히스테리시스, 끊김 복구를 구현한다. 독립 세션에서 이벤트 F1·정지 오작동·지연을 실측한 뒤 양발/아바타 연동을 판단한다. 실제 음성·영상은 GitHub에 올리지 않는다.
## 검증 범위

- Node 테스트 3개: 합성 반향 피크·WAV 헤더, 능동/무음 워크렛, 분리된 세션의 판별 및 unknown 처리.
- Windows Chrome 헤드리스, 가상 마이크·음소거: 두 모드 각 6초 세션, WAV·JSON 파일 실제 다운로드, 중지 및 폐기, 업로드와 비허용 경로 차단.
- Android 실기기와 실제 발 데이터 없음. 물리적 반향, 발 구별, 실시간 지연 및 방송 연동은 미검증.
