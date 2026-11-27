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
//   "motion": true,                          // 선택, 기본 true: 천천히 확대 + 본문이 뒤늦게 등장
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

function sceneHtml(spec, scene, index, total, hideBody = false) {
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
  ${scene.body ? `<div class="body" style="${hideBody ? 'visibility:hidden' : ''}">${lines(scene.body)}</div>` : ''}
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
      // 본문이 있으면 제목만 보이는 첫 상태도 만든다(본문이 뒤늦게 나타나는 효과).
      let pre = null;
      if (spec.scenes[i].body && spec.motion !== false) {
        fs.writeFileSync(tmp, sceneHtml(spec, spec.scenes[i], i, spec.scenes.length, true));
        await page.goto(pathToFileURL(tmp).href);
        await page.evaluate(() => document.fonts.ready);
        pre = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}-pre.png`);
        await page.screenshot({ path: pre });
      }
      frames.push({ full: file, pre });
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }
  if (overflowed.length) {
    console.error(`글이 화면 안전 영역을 넘칩니다: ${overflowed.join(', ')}번 장면. 문장을 줄이세요.`);
    process.exit(2);
  }

  // 장면마다 조각을 만든다: 천천히 확대(움직임) + 본문 뒤늦게 등장 + 짧은 페이드.
  const parts = [];
  const zoomSeg = (img, d, out, fadeIn, fadeOut, z0, z1) => {
    const n = Math.max(1, Math.round(d * FPS));
    const z = `${z0}+(${z1}-${z0})*on/${n}`;
    const vf = [
      `scale=${W * 2}:${H * 2}`,
      `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS}`,
      'format=yuv420p',
      fadeIn ? `fade=t=in:st=0:d=${FADE}` : null,
      fadeOut ? `fade=t=out:st=${Math.max(0, d - FADE)}:d=${FADE}` : null,
    ].filter(Boolean).join(',');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', img, '-vf', vf, '-frames:v', String(n),
      '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', out]);
    parts.push(out);
  };
  const motion = spec.motion !== false;
  spec.scenes.forEach((s, i) => {
    const d = s.seconds;
    const { full, pre } = frames[i];
    const zA = 1.0, zB = motion ? 1.035 : 1.0;
    if (pre) {
      const dPre = Math.min(0.9, d * 0.35);
      const zMid = zA + (zB - zA) * (dPre / d);
      zoomSeg(pre, dPre, path.join(outDir, `part-${i}a.mp4`), i !== 0, false, zA, zMid);
      zoomSeg(full, d - dPre, path.join(outDir, `part-${i}b.mp4`), false, true, zMid, zB);
    } else {
      zoomSeg(full, d, path.join(outDir, `part-${i}.mp4`), i !== 0, true, zA, zB);
    }
  });
  const list = path.join(outDir, 'parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const out = path.join(outDir, 'reel.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-c', 'copy', '-movflags', '+faststart', out]);
  // 표지 이미지는 첫 장면(훅)을 쓴다.
  fs.copyFileSync(frames[0].full, path.join(outDir, 'cover.png'));
  for (const f of frames) if (f.pre) fs.rmSync(f.pre, { force: true });
  for (const p of [...parts, list]) fs.rmSync(p, { force: true });
  console.log(out);
  console.log(`총 ${total}초, 장면 ${spec.scenes.length}개`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
