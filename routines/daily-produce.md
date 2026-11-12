# 일간 제작·검수

1. `CLAUDE.md`와 `config/campaign.json`을 읽는다. `target`이 비어 있으면 그 사실만 보고하고 끝낸다.
2. `planned` 상태 소재마다 `creator`에게 초안을 맡긴다.
3. `drafted`가 된 소재마다 `compliance`에게 검수를 맡긴다. 제작한 에이전트가 자기 초안을 검수하지 않는다.
4. 승인 방식에 따라 처리한다.
   - `batch`: `passed` 소재를 `reports/approval-<날짜>.md`에 모은다. 소재마다 제목, 채널, 초안 파일 경로, 검수 메모를 적는다.
   - `auto`: `passed`를 `approved`로 바꾼다.
5. `held` 소재는 승인 방식과 상관없이 같은 보고 파일의 맨 위에 걸린 이유와 함께 올린다.
6. `npm run check`를 통과시키고 `제작 <날짜>`로 커밋해 푸시한다.

보고: 통과, 보류, 반려 수와 사용자가 봐야 할 파일 경로.
