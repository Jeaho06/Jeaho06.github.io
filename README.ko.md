# 🤖 반칙 AI 오목 (Cheating AI Omok)

🇰🇷 한국어 | [🇬🇧 English](./README.md)

AI가 반칙을 사용하는 새로운 컨셉의 온라인 오목 게임입니다. 이 프로젝트는 순수 JavaScript, HTML, CSS로 제작되었으며, 사용자의 행동을 예측하고 다양한 반칙으로 대응하는 지능형 AI와 대결하는 재미를 제공합니다.

<br>

**[➡️ 게임 플레이하러 가기](https://omok.ai.kr)**

<br>
---

## ✨ 주요 기능

* **지능형 AI**: 매 수마다 모든 위치의 가치를 계산하여 최적의 수를 찾는 점수 기반 평가 함수를 사용합니다.
* **다양한 반칙 시스템**: AI는 사용자를 이기기 위해 아래와 같은 교활한 반칙들을 사용합니다.
    * **운명의 거부 (1회)**: 사용자의 결정적인 승리 수를 단 한 번 무효화시킵니다.
    * **폭탄 설치**: 특정 위치에 폭탄을 설치하고, 다음 턴에 주변의 돌을 모두 제거합니다.
    * **2번 두기**: 한 턴에 두 번 연속으로 돌을 놓아 순식간에 유리한 고지를 점합니다.
    * **돌 바꾸기**: 전세를 뒤집기 위해 자신의 돌과 상대의 돌 위치를 바꿉니다.
* **실시간 반칙 제어**: 사용자는 UI 토글 버튼을 통해 AI가 사용할 반칙을 실시간으로 켜고 끌 수 있습니다.
* **다국어 지원**: 한국어, 영어, 일본어를 지원하며, 언어 파일을 추가하여 쉽게 확장할 수 있습니다.
* **상세한 로그**: 기보(수순)와 AI가 왜 그곳에 두었는지를 설명하는 로그를 분리하여 제공합니다.

---

---

## 🚀 로컬에서 실행하기

이 프로젝트는 `lang` 폴더의 `json` 파일을 불러오기 위해 웹 서버 환경이 필요합니다.

1.  저장소를 로컬 컴퓨터에 복제(Clone)합니다.
    ```bash
    git clone [https://github.com/Jeaho06/Jeaho06.github.io.git](https://github.com/Jeaho06/Jeaho06.github.io.git)
    ```
2.  VS Code에서 프로젝트 폴더를 엽니다.
3.  [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) 확장 프로그램을 설치합니다.
4.  `index.html` 파일 위에서 마우스 오른쪽 버튼을 클릭하고 `Open with Live Server`를 선택하여 실행합니다.

---

## 📜 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 `LICENSE` 파일을 참고하세요.
