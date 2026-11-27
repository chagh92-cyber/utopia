#!/usr/bin/env node
// 릴스 영상 생성기 v2: 애니메이션 + 그림(이모지) + 음성 해설.
//
// 사용법: npm run reel -- content/<id>/reel.json
// 결과:   같은 폴더의 reel/reel.mp4 (1080x1920, 30fps, H.264 + AAC), reel/cover.png
//
// 장면마다 HTML을 한 프레임씩 그려(애니메이션 시간을 직접 지정) 영상으로 만든다.
// 음성은 tools/tts.js(구글 Cloud TTS)로 장면별 해설을 만들고, 해설 길이에 맞춰 장면 길이를 늘린다.
// TTS를 쓸 수 없으면 음성 없이 만든다(경고만 출력).
//
// reel.json 형식:
// {
//   "brand": "@salmal.tech",
//   "notice": "표시 문구(선택)",
//   "theme": "dark" | "light",
//   "accent": "#5b8cff",
//   "voice": true,                       // 선택, 기본 true. 해설 음성 사용
//   "voiceName": "ko-KR-Chirp3-HD-Aoede", // 선택(기본: 사용자가 고른 목소리)
//   "scenes": [
//     {
//       "icon": "📺",                     // 선택. 이모지 그림(튀어나오며 등장, 둥실 움직임)
//       "kicker": "작은 머리말(선택)",
//       "title": "큰 글자. {n}은 count 값으로 바뀌며 숫자가 올라간다",
//       "body": "본문(선택). 줄마다 차례로 등장",
//       "count": { "to": 490800, "from": 0, "format": "comma" },   // 선택
//       "say": "이 장면에서 읽을 해설(선택, 없으면 title + body를 읽는다)",
//       "seconds": 2.5                     // 최소 길이. 해설이 길면 자동으로 늘어난다
//     }
//   ]
// }
// 화면 아래 약 25%와 오른쪽 끝은 인스타그램 UI가 덮으므로 글자를 두지 않는다.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { synthesize } = require('./tts');

const W = 1080;
const H = 1920;
const FPS = 30;

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function sceneHtml(spec, scene, index, total, duration) {
  const dark = spec.theme !== 'light';
  const bg = dark ? '#121216' : '#f7f5f0';
  const fg = dark ? '#f4f4f6' : '#16161a';
  const sub = dark ? '#c2c2cf' : '#45454f';
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(spec.accent || '') ? spec.accent : '#5b8cff';
  const hook = index === 0;
  const titleHtml = esc(scene.title).replace(/\n/g, '<br>').replace('{n}', '<span id="count"></span>');
  const bodyLines = scene.body ? String(scene.body).split('\n') : [];
  const outAt = Math.max(0, duration - 0.22);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:${bg};color:${fg};font-family:"Pretendard","Noto Color Emoji",sans-serif;word-break:keep-all;overflow-wrap:anywhere;position:relative}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:${dark ? 0.35 : 0.25}}
.b1{width:760px;height:760px;background:${accent};left:-220px;top:220px;animation:drift1 6s ease-in-out infinite alternate}
.b2{width:620px;height:620px;background:${dark ? '#8a5cff' : '#ffb35c'};right:-200px;top:900px;animation:drift2 7s ease-in-out infinite alternate}
@keyframes drift1{to{transform:translate(160px,120px) scale(1.1)}}
@keyframes drift2{to{transform:translate(-140px,-160px) scale(0.92)}}
.wrap{position:absolute;inset:0;padding:0 96px 0 84px;display:flex;flex-direction:column;
  animation:out .22s ease-in ${outAt}s forwards}
@keyframes out{to{opacity:0;transform:translateY(-24px)}}
.notice{margin:0 -96px 0 -84px;padding:150px 84px 26px;background:${accent};color:${dark ? '#0b0b0e' : '#fff'};font-size:34px;font-weight:800;line-height:1.35}
.prog{margin-top:${spec.notice ? 36 : 150}px;height:8px;display:flex;gap:10px}
.prog i{flex:1;border-radius:4px;background:${dark ? '#2a2a33' : '#dedbd3'};overflow:hidden}
.prog i.done{background:${accent}}
.prog i.now::after{content:"";display:block;height:100%;width:100%;background:${accent};transform-origin:left;
  animation:fill ${duration}s linear forwards;transform:scaleX(0)}
@keyframes fill{to{transform:scaleX(1)}}
.main{flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:${Math.round(H * 0.25)}px}
.icon{font-size:${hook ? 210 : 170}px;line-height:1;margin-bottom:40px;display:inline-block;
  animation:pop ${hook ? '.3s' : '.45s'} cubic-bezier(.2,1.6,.4,1) both, float 2.4s ease-in-out .45s infinite alternate}
@keyframes pop{from{transform:scale(0) rotate(-12deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
@keyframes float{to{transform:translateY(-18px) rotate(3deg)}}
.kicker{font-size:46px;font-weight:700;color:${accent};margin-bottom:30px;animation:fade .35s ease-out .08s both}
.title{font-size:${hook ? 112 : 88}px;font-weight:800;line-height:1.16;letter-spacing:-0.035em;animation:up ${hook ? '.3s' : '.5s'} cubic-bezier(.2,.9,.3,1) ${hook ? '0s' : '.15s'} both}
.body{margin-top:50px;font-size:52px;font-weight:500;line-height:1.55;color:${sub};letter-spacing:-0.015em}
.body div{animation:up .45s cubic-bezier(.2,.9,.3,1) both}
@keyframes up{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
#count{color:${accent}}
.foot{position:absolute;left:84px;bottom:${Math.round(H * 0.25) - 90}px;font-size:34px;font-weight:700;color:${sub}}
</style></head><body>
<div class="blob b1"></div><div class="blob b2"></div>
<div class="wrap">
${spec.notice ? `<div class="notice">${esc(spec.notice)}</div>` : ''}
<div class="prog">${Array.from({ length: total }, (_, i) => `<i class="${i < index ? 'done' : i === index ? 'now' : ''}"></i>`).join('')}</div>
<div class="main">
  ${scene.icon ? `<div><span class="icon">${esc(scene.icon)}</span></div>` : ''}
  ${scene.kicker ? `<div class="kicker">${esc(scene.kicker)}</div>` : ''}
  <div class="title">${titleHtml}</div>
  ${bodyLines.length ? `<div class="body">${bodyLines.map((l, i) => `<div style="animation-delay:${(0.55 + i * 0.28).toFixed(2)}s">${esc(l) || '&nbsp;'}</div>`).join('')}</div>` : ''}
</div>
<div class="foot">${esc(spec.brand)}</div>
</div>
<script>
const C = ${JSON.stringify(scene.count || null)};
window.__seek = (t) => {
  for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
  if (C) {
    const k = Math.min(1, Math.max(0, (t - 0.3) / 1.0));
    const e = 1 - Math.pow(1 - k, 3);
    const v = Math.round((C.from || 0) + ((C.to) - (C.from || 0)) * e);
    document.getElementById('count').textContent = C.format === 'plain' ? String(v) : v.toLocaleString('ko-KR');
  }
};
</script>
</body></html>`;
}

function probeSeconds(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString();
  return parseFloat(out);
}

const sayText = (s) => s.say || [s.title.replace('{n}', s.count ? String(s.count.to) : ''), s.body || ''].join('. ').replace(/\n/g, ', ');

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

  const outDir = path.join(path.dirname(path.resolve(input)), 'reel');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // 1) 음성: 장면별 해설을 만들고 길이를 잰다.
  let voiced = false;
  const audio = [];
  if (spec.voice !== false) {
    try {
      for (let i = 0; i < spec.scenes.length; i++) {
        const mp3 = path.join(outDir, `voice-${i}.mp3`);
        synthesize(sayText(spec.scenes[i]), mp3, { voiceName: spec.voiceName });
        audio.push({ file: mp3, seconds: probeSeconds(mp3) });
      }
      voiced = true;
    } catch (e) {
      console.error(`음성 없이 만듭니다: ${e.message}`);
      audio.length = 0;
    }
  }
  const durations = spec.scenes.map((s, i) => Math.max(s.seconds, voiced ? audio[i].seconds + 0.45 : 0));
  const total = durations.reduce((a, b) => a + b, 0);
  if (total > 90) throw new Error(`총 ${total.toFixed(1)}초입니다. 정보 릴스는 90초 안쪽으로 만드세요.`);

  // 2) 영상: 프레임을 하나씩 그려 ffmpeg로 보낸다.
  const silent = path.join(outDir, 'video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), silent]);
  const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg 종료 코드 ${c}`)))));
  const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

  const tmp = path.join(outDir, '.render.html');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const overflowed = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    for (let i = 0; i < spec.scenes.length; i++) {
      const d = durations[i];
      fs.writeFileSync(tmp, sceneHtml(spec, spec.scenes[i], i, spec.scenes.length, d));
      await page.goto(pathToFileURL(tmp).href);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((t) => window.__seek(t), d - 0.3);
      const fits = await page.evaluate(() => {
        const m = document.querySelector('.main');
        return m.scrollHeight <= m.clientHeight + 1 && document.documentElement.scrollWidth <= innerWidth;
      });
      if (!fits) overflowed.push(i + 1);
      if (i === 0) {
        await page.evaluate((t) => window.__seek(t), Math.min(1.6, d - 0.3));
        await page.screenshot({ path: path.join(outDir, 'cover.png') });
      }
      const n = Math.round(d * FPS);
      for (let f = 0; f < n; f++) {
        await page.evaluate((t) => window.__seek(t), f / FPS);
        await write(await page.screenshot({ type: 'jpeg', quality: 92 }));
      }
    }
  } finally {
    ff.stdin.end();
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }
  await ffDone;
  if (overflowed.length) {
    console.error(`글이 화면 안전 영역을 넘칩니다: ${overflowed.join(', ')}번 장면. 문장을 줄이세요.`);
    process.exit(2);
  }

  // 3) 소리 합치기: 장면 길이에 맞춰 해설 뒤를 무음으로 채워 이어 붙인다.
  const out = path.join(outDir, 'reel.mp4');
  if (voiced) {
    const pads = audio.map((a, i) => {
      const w = path.join(outDir, `pad-${i}.wav`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a.file, '-af', `adelay=150|150,apad`, '-t', durations[i].toFixed(3), '-ar', '44100', '-ac', '2', w]);
      return w;
    });
    const list = path.join(outDir, 'audio.txt');
    fs.writeFileSync(list, pads.map((p) => `file '${p}'`).join('\n'));
    const track = path.join(outDir, 'voice.wav');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', track]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', track, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
      '-shortest', '-movflags', '+faststart', out]);
    for (const p of [...pads, list, track, ...audio.map((a) => a.file)]) fs.rmSync(p, { force: true });
  } else {
    // 인스타그램이 무음 트랙 없는 영상도 받지만, 일부 플레이어 호환을 위해 무음 오디오를 붙인다.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out]);
  }
  fs.rmSync(silent, { force: true });
  console.log(out);
  console.log(`총 ${total.toFixed(1)}초, 장면 ${spec.scenes.length}개, 음성 ${voiced ? '있음' : '없음'}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
