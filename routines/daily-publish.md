# 일간 게시 예약

1. `CLAUDE.md`와 `config/campaign.json`을 읽는다.
2. `batch` 방식이면 최근 `reports/approval-*.md`에서 사용자가 승인 표시한 소재를 `approved`로 바꾼다.
   승인 표시는 해당 줄의 `[x]`다. 표시가 없는 소재는 건드리지 않는다.
3. `channel-manager`에게 `approved` 소재의 게시 예약과 이전 예약 건의 게시 확인을 맡긴다.
4. `npm run check`를 통과시키고 `게시 <날짜>`로 커밋해 푸시한다.

보고: 예약된 건과 시각, 게시 확인된 건, 실패한 건과 이유.
커넥터가 없으면 예약하지 않고 대기 중인 건수만 보고한다.
