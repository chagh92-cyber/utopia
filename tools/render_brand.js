#!/usr/bin/env node
// 계정 브랜드 이미지 생성기: 프로필 이미지(1080x1080)와 X 헤더(1500x500).
// 사용법: node tools/render_brand.js config/accounts.json
// accounts.json의 brand 항목(name, mark, tagline, accent, bg, fg)을 읽어 brand/ 폴더에 PNG를 만든다.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fontFaces() {
  const dir = path.join(root, 'node_modules', 'pretendard', 'dist', 'web', 'static', 'woff2');
  return [[700, 'Bold'], [800, 'ExtraBold'], [900, 'Black']]
    .map(([w, n]) => `@font-face{font-family:"Pretendard";font-weight:${w};src:url("${pathToFileURL(path.join(dir, `Pretendard-${n}.woff2`))}") format("woff2");}`)
    .join('\n');
}

function avatar(b) {
  // 원형으로 잘려도 글자가 남도록 가운데 60% 안에만 그린다.
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
*{margin:0;padding:0}html,body{width:1080px;height:1080px}
body{background:${b.accent};display:flex;align-items:center;justify-content:center;font-family:"Pretendard",sans-serif}
.m{color:${b.fg_on_accent};font-size:330px;font-weight:900;letter-spacing:-0.06em;line-height:1}
.q{color:${b.bg};}
</style></head><body><div class="m">${esc(b.mark)}<span class="q">?</span></div></body></html>`;
}

function header(b) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1500px;height:500px}
body{background:${b.bg};color:${b.fg};font-family:"Pretendard",sans-serif;display:flex;align-items:center;
  justify-content:flex-end;padding:0 110px 0 0}
.w{text-align:right}
.t{font-size:92px;font-weight:900;letter-spacing:-0.045em;line-height:1.1}
.t b{color:${b.accent};font-weight:900}
.s{margin-top:22px;font-size:38px;font-weight:700;color:${b.sub};letter-spacing:-0.02em}
</style></head><body><div class="w"><div class="t">${esc(b.header_title).replace(esc(b.header_accent), `<b>${esc(b.header_accent)}</b>`).replace(/\n/g, "<br>")}</div>
<div class="s">${esc(b.tagline)}</div></div></body></html>`;
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2] || path.join(root, 'config/accounts.json'), 'utf8'));
  const b = cfg.brand;
  const out = path.join(root, 'brand');
  fs.mkdirSync(out, { recursive: true });
  const tmp = path.join(out, '.render.html');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const [name, html, w, h] of [['avatar.png', avatar(b), 1080, 1080], ['x-header.png', header(b), 1500, 500]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      fs.writeFileSync(tmp, html);
      await page.goto(pathToFileURL(tmp).href);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, name) });
      await page.close();
      console.log(path.join(out, name));
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
