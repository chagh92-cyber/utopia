#!/usr/bin/env node
// 카드뉴스 이미지 생성기.
//
// 사용법: npm run cards -- content/<id>/cards.json
// 결과:   같은 폴더의 cards/01.png, 02.png, ... (1080x1350, 인스타그램 4:5)
//
// cards.json 형식:
// {
//   "brand": "계정 이름(선택, 카드 아래에 표시)",
//   "notice": "표시 문구(선택). 모든 카드 맨 위에 눈에 띄는 띠로 표시. 광고·추천 표시에 쓴다",
//   "theme": "light" | "dark" | "accent",   // 선택, 기본 light
//   "accent": "#2f6bff",                     // 선택, 강조색
//   "cards": [
//     { "kicker": "작은 머리말(선택)", "title": "큰 제목", "body": "본문(선택). 줄바꿈은 \n" }
//   ]
// }
// 첫 카드는 표지로 크게 그린다. 제목은 카드당 40자, 본문은 140자 안쪽이 읽기 좋다.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const THEMES = {
  light: { bg: '#f7f5f0', fg: '#16161a', sub: '#5b5b66' },
  dark: { bg: '#121216', fg: '#f4f4f6', sub: '#a3a3b2' },
  accent: { bg: null, fg: '#ffffff', sub: 'rgba(255,255,255,0.82)' },
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const lines = (s) => esc(s).replace(/\n/g, '<br>');

function fontFaces() {
  const dir = path.join(__dirname, '..', 'node_modules', 'pretendard', 'dist', 'web', 'static', 'woff2');
  const weights = { 500: 'Medium', 700: 'Bold', 800: 'ExtraBold' };
  return Object.entries(weights)
    .map(([weight, name]) => {
      const file = path.join(dir, `Pretendard-${name}.woff2`);
      if (!fs.existsSync(file)) {
        throw new Error('글꼴 파일이 없습니다. 먼저 npm install을 실행하세요.');
      }
      return `@font-face{font-family:"Pretendard";font-weight:${weight};src:url("${pathToFileURL(file)}") format("woff2");}`;
    })
    .join('\n');
}

function cardHtml(spec, card, index, total) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(spec.accent || '') ? spec.accent : '#2f6bff';
  const theme = THEMES[spec.theme] || THEMES.light;
  const bg = theme.bg || accent;
  const mark = spec.theme === 'accent' ? '#ffffff' : accent;
  const cover = index === 0;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px}
body{background:${bg};color:${theme.fg};font-family:"Pretendard",sans-serif;
  display:flex;flex-direction:column;padding:96px 88px 72px;word-break:keep-all;overflow-wrap:anywhere}
.kicker{font-size:34px;font-weight:700;color:${mark};letter-spacing:-0.01em;margin-bottom:28px}
.main{flex:1;display:flex;flex-direction:column;justify-content:${cover ? 'center' : 'flex-start'}}
.title{font-size:${cover ? 104 : 76}px;font-weight:800;line-height:1.18;letter-spacing:-0.035em}
.rule{width:96px;height:10px;border-radius:5px;background:${mark};margin:44px 0}
.body{font-size:42px;font-weight:500;line-height:1.6;letter-spacing:-0.015em;color:${theme.sub}}
.notice{margin:-96px -88px 64px;padding:26px 88px;background:${mark};color:${spec.theme === 'accent' ? accent : (spec.theme === 'dark' ? '#0b0b0e' : '#ffffff')};
  font-size:32px;font-weight:800;letter-spacing:-0.01em;line-height:1.35}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:28px;font-weight:700;color:${theme.sub}}
</style></head><body>
${spec.notice ? `<div class="notice">${esc(spec.notice)}</div>` : ''}
<div class="main">
  ${card.kicker ? `<div class="kicker">${esc(card.kicker)}</div>` : ''}
  <div class="title">${lines(card.title)}</div>
  ${card.body ? `<div class="rule"></div><div class="body">${lines(card.body)}</div>` : ''}
</div>
<div class="foot"><span>${esc(spec.brand)}</span><span>${index + 1} / ${total}</span></div>
</body></html>`;
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('사용법: npm run cards -- content/<id>/cards.json');
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(spec.cards) || spec.cards.length === 0) {
    throw new Error('cards 배열이 비어 있습니다.');
  }
  spec.cards.forEach((card, i) => {
    if (!card.title) throw new Error(`${i + 1}번 카드에 title이 없습니다.`);
  });

  const outDir = path.join(path.dirname(path.resolve(input)), 'cards');
  fs.mkdirSync(outDir, { recursive: true });
  // 임시 HTML을 파일로 열어야 글꼴의 file:// 주소를 읽을 수 있다.
  const tmp = path.join(outDir, '.render.html');

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const overflowed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    for (let i = 0; i < spec.cards.length; i++) {
      fs.writeFileSync(tmp, cardHtml(spec, spec.cards[i], i, spec.cards.length));
      await page.goto(pathToFileURL(tmp).href);
      await page.evaluate(() => document.fonts.ready);
      const fits = await page.evaluate(
        () => document.documentElement.scrollHeight <= 1350 && document.documentElement.scrollWidth <= 1080
      );
      if (!fits) overflowed.push(i + 1);
      const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }
  if (overflowed.length) {
    console.error(`글이 카드 밖으로 넘칩니다: ${overflowed.join(', ')}번 카드. 문장을 줄이세요.`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
