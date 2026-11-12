# 일간 리서치·기획

1. `CLAUDE.md`와 `config/campaign.json`을 읽는다. `target`이 비어 있으면 그 사실만 보고하고 끝낸다.
2. `researcher`에게 오늘의 소재 후보 5~10개를 받는다.
3. 후보를 `state/queue.json`에 `idea` 상태로 넣는다. 이미 있는 소재와 겹치면 넣지 않는다.
4. `strategist`에게 오늘 제작할 소재를 고르게 하고 브리프를 받는다.
5. `npm run check`를 통과시키고 `리서치 <날짜>`로 커밋해 푸시한다.

보고: 새 후보 수, 선택된 소재 제목, 조사가 막힌 채널.
