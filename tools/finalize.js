#!/usr/bin/env node
// 게시용 최종본 생성기: 초안의 {{자리표시자}}를 config/campaign.json 값으로 채워 content/<id>/final/에 쓴다.
// 사용법: npm run finalize -- <소재 id> [<소재 id> ...]
// 채울 값이 없는 자리표시자가 하나라도 있으면 아무것도 쓰지 않고 실패한다.
// 채널 매니저는 게시 예약 때 이 최종본을 쓴다. 커넥터가 없으면 사람이 이 파일을 복사해 올린다.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const campaign = JSON.parse(fs.readFileSync(path.join(root, 'config/campaign.json'), 'utf8'));
const queue = JSON.parse(fs.readFileSync(path.join(root, 'state/queue.json'), 'utf8'));
const DRAFTS = ['blog.md', 'instagram.md', 'threads.md', 'x.md', 'shorts.md'];
const READY = ['passed', 'approved', 'scheduled', 'published', 'measured'];

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('사용법: npm run finalize -- <소재 id> [...]');
  process.exit(1);
}

let failed = false;
for (const id of ids) {
  const item = queue.items.find((i) => i.id === id);
  if (!item) { console.error(`${id}: 큐에 없음`); failed = true; continue; }
  if (!READY.includes(item.status)) {
    console.error(`${id}: 검수 통과 전(${item.status})이라 최종본을 만들지 않음`);
    failed = true;
    continue;
  }
  const dir = path.join(root, 'content', id);
  const outputs = [];
  for (const f of DRAFTS) {
    const src = path.join(dir, f);
    if (!fs.existsSync(src)) continue;
    let missing = [];
    const text = fs.readFileSync(src, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
      const v = campaign[key.toLowerCase()];
      if (!v) { missing.push(m); return m; }
      return v;
    });
    if (missing.length) {
      console.error(`${id}/${f}: 채울 값 없음 ${[...new Set(missing)].join(', ')}`);
      failed = true;
    } else {
      outputs.push([f, text]);
    }
  }
  if (failed) continue;
  const out = path.join(dir, 'final');
  fs.mkdirSync(out, { recursive: true });
  for (const [f, text] of outputs) {
    fs.writeFileSync(path.join(out, f), text);
    console.log(path.relative(root, path.join(out, f)));
  }
}
process.exit(failed ? 1 : 0);
