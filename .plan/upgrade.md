
# remember-me 업그레이드 가이드라인
## Windows 개인 PC 음성 입력 + 실시간 STT (Whisper)

> **회의 시작 하면 아래에 시스템에 집중한다.
> **실시간 음성 입력 → STT 처리 흐름**에만 집중한다.


---

## 1. 목표 범위

### 포함
- 개인 PC 마이크 음성 입력 (Windows)
- 실시간 음성 스트리밍 처리
- Whisper 기반 STT
- Electron 앱과 외부 프로세스 연동


---

## 2. 전체 아키텍처 개요

```
[마이크]
   ↓
[가상 오디오 장치 / OS Audio]
   ↓
[ffmpeg]
   ↓ (stdout pipe)
[Python Whisper]
   ↓ (JSON)
[Electron Main]
   ↓ (IPC)
[Renderer (React)]
```

핵심 원칙:
- Electron은 **컨트롤러**
- ffmpeg는 **스트리머**
- Whisper는 **STT 엔진**

---

## 3. 역할 분리 원칙

### Electron (Main)
- ffmpeg / python 프로세스 실행
- stdout / stdin 파이프 연결
- 프로세스 생명주기 관리

### Python (Whisper)
- stdin 기반 오디오 입력
- chunk 단위 STT
- JSON만 stdout으로 출력

### Renderer (React)
- STT 결과 표시
- 사용자 인터랙션

❌ 금지
- Renderer에서 child_process 실행
- Electron에서 직접 오디오 처리

---

## 4. 음성 입력 가이드 (Windows)

### ffmpeg 사용 원칙

- Windows에서는 **DirectShow(dshow)** 사용
- 샘플레이트: 16kHz
- 채널: mono
- 출력: stdout (pipe)

#### 기준 명령

```bash
ffmpeg -f dshow -i audio="CABLE Output (VB-Audio Virtual Cable)" \
       -ar 16000 -ac 1 -f wav pipe:1
```

권장 이유:
- 장시간 안정성
- 파이프 기반 스트리밍 최적
- Whisper와 궁합이 가장 좋음

---

## 5. Python Whisper 연동 가이드

### 실행 구조

```
Electron(Main)
  └─ spawn(ffmpeg)
        └─ stdout
             └─ spawn(python whisper)
```

### Whisper 처리 원칙

- stdin으로만 오디오 수신
- 2~5초 chunk 단위 처리
- blocking 금지
- 결과는 JSON으로만 출력

### 출력 예시

```json
{
  "text": "안녕하세요",
  "start": 12.3,
  "end": 14.8
}
```

---

## 6. Chunk 전략 가이드

| 항목 | 권장 |
|---|---|
| chunk 길이 | 2~5초 |
| overlap | 0.3~0.5초 |
| 모델 | small / medium |
| GPU | 있으면 CUDA 사용 |

목표:
- 지연 최소화
- 문장 단절 최소화

---

## 7. Electron IPC 가이드

### 데이터 흐름

```
Python stdout
   ↓
Electron Main
   ↓ IPC
Renderer
```

### 원칙
- JSON line 단위 파싱
- Main에서만 파싱
- Renderer는 데이터 소비만 담당

---

## 8. 안정성 가이드

필수 체크 사항:

- ffmpeg 종료 감지
- python 프로세스 hang 감지
- 마이크 디바이스 변경 대응
- 앱 종료 시 모든 child process kill

---

## 9. 빌드 & 배포 원칙

- 시스템 Python 의존 금지
- ffmpeg / whisper / python-runtime 모두 패키징
- 실행 경로는 process.resourcesPath 기준

---

## 10. 최종 요약

> 이 프로젝트는 **스트리밍 파이프라인**이 핵심이다.  
> Electron은 orchestration만 담당하고,  
> 무거운 작업은 반드시 외부 프로세스로 분리한다.

---

### 이 문서는 바이브 코딩용 참고 문서이며,
### 세부 구현은 실험과 반복을 전제로 한다.
