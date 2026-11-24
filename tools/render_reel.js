#!/usr/bin/env node
// 릴스 영상 생성기: 장면별 텍스트를 1080x1920 이미지로 그린 뒤 ffmpeg로 이어 붙여 MP4를 만든다.
// 카메라·촬영 없이 텍스트 중심 정보 릴스를 자동으로 만들기 위한 도구다.
//
// 사용법: npm run reel -- content/<id>/reel.json
// 결과:   같은 폴더의 reel/reel.mp4 (H.264, 30fps, 무음)
//
// reel.json 형식:
// {
//   "brand": "@salmal.tech",
//   "notice": "표시 문구(선택). 모든 장면 위쪽에 띠로 표시",
//   "theme": "dark" | "light",
//   "accent": "#5b8cff",
//   "scenes": [
//     { "kicker": "작은 머리말(선택)", "title": "큰 글자", "body": "본문(선택)", "seconds": 2.5 }
//   ]
// }
// 첫 장면이 훅이다. 1~2초 안에 읽히는 한 문장으로 쓴다.
// 화면 아래 약 25%와 오른쪽 끝은 인스타그램 버튼·캡션이 덮으므로 글자를 두지 않는다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const W = 1080;
const H = 1920;
const FPS = 30;
const FADE = 0.25;

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (s) => esc(s).replace(/\n/g, '<br>');

function fontFaces() {
  const dir = path.join(__dirname, '..', 'node_modules', 'pretendard', 'dist', 'web', 'static', 'woff2');
  return [[500, 'Medium'], [700, 'Bold'], [800, 'ExtraBold']]
    .map(([w, n]) => {
      const file = path.join(dir, `Pretendard-${n}.woff2`);
      if (!fs.existsSync(file)) throw new Error('글꼴 파일이 없습니다. 먼저 npm install을 실행하세요.');
      return `@font-face{font-family:"Pretendard";font-weight:${w};src:url("${pathToFileURL(file)}") format("woff2");}`;
    })
    .join('\n');
}

function sceneHtml(spec, scene, index, total) {
  const dark = spec.theme !== 'light';
  const bg = dark ? '#121216' : '#f7f5f0';
  const fg = dark ? '#f4f4f6' : '#16161a';
  const sub = dark ? '#b4b4c2' : '#4b4b55';
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(spec.accent || '') ? spec.accent : '#5b8cff';
  const hook = index === 0;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px}
body{background:${bg};color:${fg};font-family:"Pretendard",sans-serif;word-break:keep-all;overflow-wrap:anywhere;
  display:flex;flex-direction:column;padding:0 96px 0 84px}
.notice{margin:0 -96px 0 -84px;padding:150px 84px 26px;background:${accent};color:${dark ? '#0b0b0e' : '#fff'};
  font-size:34px;font-weight:800;line-height:1.35}
.main{flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:${Math.round(H * 0.25)}px}
.kicker{font-size:46px;font-weight:700;color:${accent};margin-bottom:34px}
.title{font-size:${hook ? 118 : 92}px;font-weight:800;line-height:1.16;letter-spacing:-0.035em}
.body{margin-top:54px;font-size:52px;font-weight:500;line-height:1.55;color:${sub};letter-spacing:-0.015em}
.foot{position:absolute;left:84px;bottom:${Math.round(H * 0.25) - 90}px;font-size:34px;font-weight:700;color:${sub}}
.prog{position:absolute;left:84px;right:96px;top:${spec.notice ? 236 : 150}px;height:8px;display:flex;gap:10px}
.prog i{flex:1;border-radius:4px;background:${dark ? '#2a2a33' : '#dedbd3'}}
.prog i.on{background:${accent}}
</style></head><body>
${spec.notice ? `<div class="notice">${esc(spec.notice)}</div>` : '<div style="height:150px"></div>'}
<div class="prog">${Array.from({ length: total }, (_, i) => `<i class="${i <= index ? 'on' : ''}"></i>`).join('')}</div>
<div class="main">
  ${scene.kicker ? `<div class="kicker">${esc(scene.kicker)}</div>` : ''}
  <div class="title">${lines(scene.title)}</div>
  ${scene.body ? `<div class="body">${lines(scene.body)}</div>` : ''}
</div>
<div class="foot">${esc(spec.brand)}</div>
</body></html>`;
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('사용법: npm run reel -- content/<id>/reel.json');
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) throw new Error('scenes가 비어 있습니다.');
  spec.scenes.forEach((s, i) => {
    if (!s.title) throw new Error(`${i + 1}번 장면에 title이 없습니다.`);
    if (!(s.seconds > 0)) s.seconds = 2.5;
  });
  const total = spec.scenes.reduce((n, s) => n + s.seconds, 0);
  if (total > 90) throw new Error(`총 ${total}초입니다. 정보 릴스는 90초 안쪽으로 만드세요.`);

  const outDir = path.join(path.dirname(path.resolve(input)), 'reel');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = path.join(outDir, '.render.html');

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const overflowed = [];
  const frames = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    for (let i = 0; i < spec.scenes.length; i++) {
      fs.writeFileSync(tmp, sceneHtml(spec, spec.scenes[i], i, spec.scenes.length));
      await page.goto(pathToFileURL(tmp).href);
      await page.evaluate(() => document.fonts.ready);
      const fits = await page.evaluate(() => {
        const m = document.querySelector('.main');
        return m.scrollHeight <= m.clientHeight + 1 && document.documentElement.scrollWidth <= innerWidth;
      });
      if (!fits) overflowed.push(i + 1);
      const file = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      frames.push(file);
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }
  if (overflowed.length) {
    console.error(`글이 화면 안전 영역을 넘칩니다: ${overflowed.join(', ')}번 장면. 문장을 줄이세요.`);
    process.exit(2);
  }

  // 장면마다 짧은 페이드 인·아웃을 넣은 조각을 만들고 이어 붙인다.
  const parts = [];
  spec.scenes.forEach((s, i) => {
    const part = path.join(outDir, `part-${i}.mp4`);
    const d = s.seconds;
    const vf = [
      `scale=${W}:${H}`,
      'format=yuv420p',
      i === 0 ? null : `fade=t=in:st=0:d=${FADE}`,
      `fade=t=out:st=${Math.max(0, d - FADE)}:d=${FADE}`,
    ].filter(Boolean).join(',');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-t', String(d), '-i', frames[i],
      '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', part]);
    parts.push(part);
  });
  const list = path.join(outDir, 'parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const out = path.join(outDir, 'reel.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-c', 'copy', '-movflags', '+faststart', out]);
  // 표지 이미지는 첫 장면(훅)을 쓴다.
  fs.copyFileSync(frames[0], path.join(outDir, 'cover.png'));
  for (const p of [...parts, list]) fs.rmSync(p, { force: true });
  console.log(out);
  console.log(`총 ${total}초, 장면 ${spec.scenes.length}개`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
