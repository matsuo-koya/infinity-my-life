/* ══════════════════════════════════════════════════════════════
   半速録音 — 1965年10月22日、EMIスタジオでやられたこと

   レノンに「バロックっぽいものを」と頼まれたジョージ・マーティンは、
   バッハ風のソロを書いたが、曲の速さでは弾けなかった。
   そこで技師スチュアート・エルサムにテープを半分の速さで回させ、
   1オクターヴ下をゆっくり弾いた。戻したとき、それは倍の速さ・
   1オクターヴ上になり、ついでにハープシコードのような音になっていた。

   ここでやっているのは、まったく同じ演算である。
     ① 半分の速さ・1オクターヴ下で、いったん書き出す（OfflineAudioContext）
     ② その音を再生速度2.0で鳴らす

   結果として起きること。
     ・減衰が半分になる（音が短く、硬くなる）
     ・立ち上がりの雑音が高いほうへ寄る（撥弦のように聞こえる）
     ・そして人間の間合いが半分に圧縮されて、ほとんど平らになる

   三つめがいちばん効く。上手い人が弾いているのに、
   誰も弾いていないように聞こえるのは、これのためだと思う。
   ══════════════════════════════════════════════════════════════ */

export const RATIO = 2;

/* sch は perform.schedule() が返すもの。voiceFor(ctx, dest) で発音体を作る */
export async function renderHalfSpeed(sampleRate, sch, voiceFor, opts = {}) {
  const { temp = "equal", a4 = 440, tail = 3.0, octave = 12 } = opts;
  const seconds = (sch.length + tail) * RATIO;
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new Ctx(2, Math.ceil(sampleRate * seconds), sampleRate);

  const bus = off.createGain(); bus.gain.value = 0.9;
  bus.connect(off.destination);
  const voice = voiceFor(off, bus);

  for (const n of sch.notes)
    voice(n.midi - octave, n.t * RATIO + 0.05, n.dur * RATIO, n.vel, temp, a4);

  return off.startRendering();
}

/* 書き出したものを倍速で鳴らす。テープを戻す側 */
export function playBuffer(ac, out, buffer, when = 0, rate = RATIO) {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  src.connect(out);
  src.start(when);
  return src;
}
