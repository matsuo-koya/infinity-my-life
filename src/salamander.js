/* ══════════════════════════════════════════════════════════════
   Salamander Grand Piano — 標本による再生

   短3度おきに録られた30個の標本で88鍵ぶんを賄う。実物は現代の
   コンサート・グランド（Yamaha C5）なので、1787年の音ではない。
   ヴァルターのフォルテピアノと聴きくらべるためのものだと思ってほしい。

   録音・制作 Alexander Holm、CC BY 3.0。
   再配布には表示が要る。public/salamander/CREDITS.txt を参照。

   標本は a′ = 440Hz の十二平均律で録られているので、
   選んだ音律・基準音高への読み替えは再生速度でおこなう。
   ══════════════════════════════════════════════════════════════ */

import { freqOf } from "./fortepiano.js";

const NAMES = { A: 9, C: 0, Ds: 3, Fs: 6 };
export const SAL_KEYS = (() => {
  const out = [];
  for (let oct = 0; oct <= 8; oct++)
    for (const n of ["A", "C", "Ds", "Fs"]) {
      if (n === "A" && oct > 7) continue;
      if (n !== "A" && oct === 0) continue;
      if (n !== "C" && oct === 8) continue;
      out.push({ name: `${n}${oct}`, midi: (oct + 1) * 12 + NAMES[n] });
    }
  return out;
})();

/* 先に揃えば鳴らしはじめられる最小の組。この曲が使う音域を優先する */
const CORE = ["C2", "Fs2", "C3", "Fs3", "C4", "Fs4", "C5", "Fs5", "C6", "A6"];

async function fetchOne(base, name, ac) {
  const res = await fetch(base + name + ".mp3");
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return ac.decodeAudioData(await res.arrayBuffer());
}

/* ① 同梱 → ② Tone.js の配布元 の順に試す。
   中核10個が揃った時点で onCore を呼び、残りは鳴らしながら後追いで足す */
export async function loadSalamander(ac, bases, onProgress = () => {}, onCore = () => {}) {
  for (const base of bases) {
    const bank = new Map();
    let done = 0;
    try {
      const core = SAL_KEYS.filter((k) => CORE.includes(k.name));
      await Promise.all(core.map(async (k) => {
        bank.set(k.midi, await fetchOne(base, k.name, ac));
        onProgress(++done, SAL_KEYS.length);
      }));
      onCore(bank);

      const rest = SAL_KEYS.filter((k) => !CORE.includes(k.name));
      Promise.all(rest.map(async (k) => {
        try {
          bank.set(k.midi, await fetchOne(base, k.name, ac));
          onProgress(++done, SAL_KEYS.length);
        } catch (e) { /* 1つ2つ落ちても、近い標本で代用できる */ }
      }));
      return bank;
    } catch (e) { /* 次の置き場所を試す */ }
  }
  throw new Error("標本が読めなかった");
}

/* いちばん近い標本。短3度おきなので、ずれは最大でも1.5半音 */
function nearest(bank, midi) {
  let best = null, dist = 1e9;
  for (const k of bank.keys()) {
    const d = Math.abs(k - midi);
    if (d < dist) { dist = d; best = k; }
  }
  return best;
}

export function makeSampler(ac, out, bank) {
  return (midi, t0, dur, vel, temp, a4) => {
    const key = nearest(bank, midi);
    if (key == null) return;
    const buf = bank.get(key);
    const want = freqOf(midi, temp, a4);
    const have = 440 * Math.pow(2, (key - 69) / 12);   /* 標本は a′=440 の平均律 */

    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = want / have;

    /* 標本は1段階の強さでしか録られていない。弱い音は暗くして寄せる */
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(18000, 1200 + 14000 * Math.pow(vel, 1.5));
    lp.Q.value = 0.2;

    const g = ac.createGain();
    const peak = Math.pow(vel, 1.6) * 0.55;
    const rel = 0.38;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.004);
    g.gain.setValueAtTime(peak, t0 + Math.max(0.02, dur));
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + Math.max(0.02, dur) + rel);

    src.connect(lp); lp.connect(g); g.connect(out);
    src.start(t0);
    src.stop(t0 + Math.max(0.02, dur) + rel + 0.02);
  };
}
