// 한국어 음성 해설 생성: 구글 Cloud Text-to-Speech(REST).
//
// 키는 코드나 저장소에 두지 않는다. 이 클라우드 환경에서는 네트워크 프록시가
// texttospeech.googleapis.com 요청의 X-Goog-Api-Key 헤더에 저장된 키를 넣어 준다.
// 다른 곳에서 쓸 때는 GOOGLE_TTS_API_KEY 환경 변수를 쓴다.
//
// curl을 쓰는 이유: curl은 HTTPS_PROXY 설정을 그대로 따른다(Node 내장 fetch는 따르지 않는다).
const fs = require('fs');
const { execFileSync } = require('child_process');

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

function synthesize(text, outFile, { voiceName, speakingRate } = {}) {
  const body = JSON.stringify({
    input: { text },
    voice: { languageCode: 'ko-KR', name: voiceName || 'ko-KR-Chirp3-HD-Aoede' },
    audioConfig: { audioEncoding: 'MP3', speakingRate: speakingRate || 1.05 },
  });
  const key = process.env.GOOGLE_TTS_API_KEY || 'proxy-injected';
  let raw;
  try {
    raw = execFileSync('curl', ['-sS', '--max-time', '30', '-X', 'POST', ENDPOINT,
      '-H', 'Content-Type: application/json; charset=utf-8',
      '-H', `X-Goog-Api-Key: ${key}`,
      '--data-binary', '@-'], { input: body }).toString();
  } catch (e) {
    throw new Error(`TTS 요청 실패: ${e.message.split('\n')[0]}`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`TTS 응답을 읽을 수 없음: ${raw.slice(0, 160)}`);
  }
  if (!json.audioContent) {
    const msg = json.error ? `${json.error.code} ${json.error.message}` : raw.slice(0, 160);
    throw new Error(`TTS 오류: ${msg}`);
  }
  fs.writeFileSync(outFile, Buffer.from(json.audioContent, 'base64'));
  return outFile;
}

module.exports = { synthesize };
