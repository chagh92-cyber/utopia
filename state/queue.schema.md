# `queue.json` 항목 형식

```json
{
  "id": "20261112-01",
  "title": "소재 한 줄 제목",
  "status": "idea",
  "created": "2026-11-12",
  "source": "어디서 발견했는지와 링크",
  "share_reason": "사람들이 이것을 남에게 보여주고 싶은 이유",
  "score": { "share": 4, "audience": 3, "effort": 5, "trend": 3, "total": 15 },
  "channels": ["instagram", "x"],
  "brief": "content/20261112-01/brief.md",
  "review": { "result": "passed", "notes": "" },
  "posts": [
    {
      "channel": "instagram",
      "scheduled_at": "2026-11-13T19:30:00+09:00",
      "post_id": null,
      "url": null
    }
  ],
  "pending_channels": ["x"],
  "metrics": { "views": null, "likes": null, "shares": null, "comments": null, "saves": null, "clicks": null },
  "updated": "2026-11-12"
}
```

- `id`는 `YYYYMMDD-순번`이고 바뀌지 않는다.
- `score`의 네 항목은 각 1~5점이다. `effort`는 만들기 쉬울수록 높다.
- `brief`, `review`, `posts`, `metrics`는 해당 단계에 도달했을 때 채운다.
- 수집하지 못한 수치는 `null`로 둔다.
- `pending_channels`는 승인됐지만 아직 예약하지 못한 채널이다(커넥터에 계정이 아직 연결되지 않은 경우 등).
- `publish_by`는 시한성 정보(할인 마감 등)를 담은 소재의 게시 기한이다. 이 날짜가 지나면 예약하지 않는다.
