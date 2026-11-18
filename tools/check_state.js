#!/usr/bin/env node
// 상태 파일 형식 검사. 루틴이 커밋하기 전에 실행한다: npm run check
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];
const fail = (msg) => errors.push(msg);

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch (e) {
    fail(`${rel}: 읽을 수 없음 (${e.message})`);
    return null;
  }
}

const STATUSES = [
  'idea', 'planned', 'drafted', 'passed', 'held', 'rejected',
  'approved', 'scheduled', 'published', 'measured',
];
const CHANNELS = ['youtube_shorts', 'instagram', 'tiktok', 'x', 'threads', 'naver_blog'];
const GOALS = ['awareness', 'followers', 'traffic'];
// 이 상태부터는 검수 통과 기록이 있어야 한다.
const NEEDS_PASS = ['approved', 'scheduled', 'published', 'measured'];
const NEEDS_BRIEF = STATUSES.filter((s) => !['idea', 'rejected'].includes(s));

const campaign = readJson('config/campaign.json');
if (campaign) {
  if (campaign.goal !== null && !GOALS.includes(campaign.goal)) {
    fail(`campaign.json: goal은 ${GOALS.join(', ')} 중 하나여야 함`);
  }
  if (!['batch', 'auto'].includes(campaign.approval)) {
    fail('campaign.json: approval은 batch 또는 auto여야 함');
  }
  if (!Array.isArray(campaign.channels)) {
    fail('campaign.json: channels는 배열이어야 함');
  } else {
    for (const c of campaign.channels) {
      if (!CHANNELS.includes(c)) fail(`campaign.json: 알 수 없는 채널 ${c}`);
    }
  }
  if (campaign.referral_link !== null && campaign.referral_link !== undefined) {
    let ok = false;
    try {
      const u = new URL(campaign.referral_link);
      ok = u.protocol === 'https:' && /(^|\.)starlink\.com$/.test(u.hostname) && u.searchParams.get('referral');
    } catch (e) { ok = false; }
    if (!ok) fail('campaign.json: referral_link는 https://starlink.com 주소에 referral 값이 있어야 함');
  }
  if (!Number.isInteger(campaign.posts_per_day) || campaign.posts_per_day < 1) {
    fail('campaign.json: posts_per_day는 1 이상의 정수여야 함');
  }
}

const queue = readJson('state/queue.json');
if (queue) {
  if (!Array.isArray(queue.items)) {
    fail('queue.json: items는 배열이어야 함');
  } else {
    const seen = new Set();
    for (const item of queue.items) {
      const where = `queue.json [${item.id || '?'}]`;
      if (!/^\d{8}-\d{2,}$/.test(item.id || '')) fail(`${where}: id 형식은 YYYYMMDD-순번`);
      if (seen.has(item.id)) fail(`${where}: id 중복`);
      seen.add(item.id);
      if (!item.title) fail(`${where}: title 없음`);
      if (!STATUSES.includes(item.status)) fail(`${where}: 알 수 없는 status ${item.status}`);
      for (const c of item.channels || []) {
        if (!CHANNELS.includes(c)) fail(`${where}: 알 수 없는 채널 ${c}`);
      }
      if (NEEDS_BRIEF.includes(item.status)) {
        if (!item.brief || !fs.existsSync(path.join(root, item.brief))) {
          fail(`${where}: ${item.status} 상태인데 브리프 파일이 없음`);
        }
      }
      if (NEEDS_PASS.includes(item.status)) {
        if (!item.review || item.review.result !== 'passed') {
          fail(`${where}: ${item.status} 상태인데 검수 통과 기록이 없음`);
        }
      }
      if (NEEDS_PASS.includes(item.status)) {
        // 승인된 초안에 채워지지 않은 자리표시자가 있으면 설정에 값이 있어야 한다.
        const dir = path.join(root, 'content', item.id || '');
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
        for (const f of files) {
          const text = fs.readFileSync(path.join(dir, f), 'utf8');
          const holes = [...new Set(text.match(/\{\{([A-Z_]+)\}\}/g) || [])];
          for (const hole of holes) {
            const key = hole.slice(2, -2).toLowerCase();
            if (!campaign || !campaign[key]) {
              fail(`${where}: ${f}의 ${hole}를 채울 값이 campaign.json의 ${key}에 없음`);
            }
          }
        }
      }
      if (['scheduled', 'published', 'measured'].includes(item.status)) {
        if (!Array.isArray(item.posts) || item.posts.length === 0) {
          fail(`${where}: ${item.status} 상태인데 posts가 비어 있음`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`상태 검사 실패 (${errors.length}건)`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
const count = queue && Array.isArray(queue.items) ? queue.items.length : 0;
const target = campaign && campaign.target ? '설정됨' : '미설정';
console.log(`상태 검사 통과: 소재 ${count}건, 캠페인 대상 ${target}`);
