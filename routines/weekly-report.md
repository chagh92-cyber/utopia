# 주간 보고

1. `CLAUDE.md`와 `config/campaign.json`을 읽는다.
2. `analyst`에게 주간 절차를 맡겨 `reports/weekly-<날짜>.md`와 갱신된 `state/lessons.md`를 받는다.
3. 승인 방식 전환을 판단한다. `batch`로 2주 이상 운영했고 그동안 사용자가 반려한 `passed` 건이
   10% 미만이면 `auto` 전환을 보고서에서 제안한다. 설정은 사용자가 승인한 뒤에만 바꾼다.
4. `npm run check`를 통과시키고 `주간 보고 <날짜>`로 커밋해 푸시한다.

보고: 주간 보고의 한 줄 결론과 사용자가 정해야 할 것.
