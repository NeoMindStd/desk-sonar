# Desk Sonar

책상 밑에 가려진 발을 공기계의 스피커와 마이크로 감지해, 앉아서 방송하는 3D 아바타에 반영하는 실험 프로젝트.

## 구성

- **책상 위:** 아이폰을 카메라로 써서 얼굴과 손을 추적한다. 단일 영상으로 시작한다면 MediaPipe, 표정이 중요하면 아이폰 TrueDepth 얼굴 트래킹과 별도 웹캠 손 트래킹을 기준으로 삼는다.
- **책상 밑:** 공기계 한 대의 스피커와 마이크로 움직이는 발의 반향 변화를 측정한다. 첫 목표는 한쪽 발의 `down / up / unknown` 상태 판별이다.
- **Windows PC:** 두 입력을 합쳐 아바타를 움직인다. 반향으로 3D 관절 좌표를 출력하거나 바이브를 대체하는 것은 초기 목표가 아니다.

## 현재 상태

한쪽 발 실험을 위한 브라우저 기록기와 오프라인 분석기가 있다. 실제 스마트폰에서 반향 수집이나 발 판별 성능은 아직 검증하지 않았다.

Node.js 20 이상에서 다음을 실행한다. 별도 패키지 설치는 없다.

```powershell
node --test
node bench/serve.mjs
```

[폰 연결 및 수집 절차](docs/handoff.md) · [검증 기준](docs/experiment.md)

## 참고

- [FingerIO](https://fingerio.cs.washington.edu/): 일반 스마트폰 내장 스피커·마이크로 근거리 손가락 움직임 추적.
- [EchoMotion](https://dl.acm.org/doi/10.1145/3832001): 스마트워치의 능동 음향 신호로 몸 자세를 추정한 연구.
- [Warudo 설정 안내](https://docs.warudo.app/docs/tutorials/getting-started): 얼굴·손 입력 조합 참고.

선행 연구는 발 판별 성능을 보장하지 않는다. 이 프로젝트의 질문은 **책상 밑에서 카메라 없이 조용한 발 들기·내리기를 안정적으로 분류할 수 있나?**다.
## 라이선스

[MIT](LICENSE)
