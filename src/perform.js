/* ══════════════════════════════════════════════════════════════
   演奏 — 並びを時間の上に置きなおす

   原典には強弱も速度も書かれていない。1790年頃の舞曲の刷り物は
   たいていそうで、そこは弾く人が補うものだった。ここでも補う。
   拍子の頭を重く、あとを軽く。終わりだけ少し引き伸ばす。

   小節の長さは枡ごとに持つ（フィナーレは 6/8 なので倍になる）ので、
   速さは「8分音符1つぶんの秒」で数える。
   ══════════════════════════════════════════════════════════════ */

import { TPE, M38 as BAR_TICKS } from "./figuration.js";

/* 装飾音を実際の音に開く。原典の記号は tr（全音）・tr（半音）・回音の3種 */
function realize(e, startT, dur) {
  const base = e.notes[e.notes.length - 1].midi;
  if (e.orn === "trill" || e.orn === "trill-half") {
    /* 古典派の作法どおり上の音から始める。終わりは主要音で収める */
    const n = dur >= 0.5 ? 8 : 6;
    const u = base + (e.orn === "trill-half" ? 1 : 2);
    const seq = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? u : base));
    seq[n - 1] = base;
    return seq.map((m, i) => ({ midi: m, t: startT + (dur * i) / n, dur: dur / n }));
  }
  if (e.orn === "mordent") {
    /* プラルトリラー。主要音・上・主要音を頭で素早く */
    const u = Math.min(dur * 0.16, 0.075);
    return [
      { midi: base, t: startT, dur: u },
      { midi: base + 2, t: startT + u, dur: u },
      { midi: base, t: startT + u * 2, dur: Math.max(0.05, dur - u * 2) },
    ];
  }
  if (e.orn === "turn" || e.orn === "turn-inv") {
    const a = e.orn === "turn" ? [base + 2, base, base - 1, base] : [base - 1, base, base + 2, base];
    const short = Math.min(dur * 0.16, 0.09);
    return a.map((m, i) => ({
      midi: m, t: startT + short * i,
      dur: i === 3 ? Math.max(0.05, dur - short * 3) : short,
    }));
  }
  return null;
}

/* list は演奏順に並んだ枡（{written, pos, volta}）。返すのは音の列と枡の時刻表 */
export function schedule(list, opts = {}) {
  const {
    barSec = 0.92,          /* 3/8 の1小節にかける秒数。ここから8分の長さを出す */
    tempoScale = 1,         /* 変奏ごとの緩急 */
    lilt = 0.10,            /* 2拍目を早める量。ウィーンの舞曲の癖 */
    human = 0.5,
    ornaments = true,
    ritard = true,
  } = opts;
  const eighth = (barSec / 3) * tempoScale;

  const notes = [];
  const bars = [];
  let t = 0;

  list.forEach((b, bi) => {
    const w = b.written;
    if (!w) return;
    const ticks = w.ticks || BAR_TICKS;
    const isLast = bi === list.length - 1;
    const scale = ritard && isLast ? 1.32 : ritard && bi === list.length - 2 ? 1.08 : 1;
    const sec = eighth * (ticks / TPE) * scale;
    bars.push({ pos: b.pos, volta: b.volta ?? 0, no: b.no, t, sec, ticks, index: bi, cell: b });

    for (const st of w.staves)
      for (const v of st)
        for (const e of v.ev) {
          if (e.rest) continue;
          const beat = (e.t % (TPE * 3)) / TPE;
          const shift = beat >= 1 && beat < 2 ? -lilt * 0.06 * sec : 0;
          const at = t + (e.t / ticks) * sec + shift + (Math.random() - 0.5) * 0.012 * human;

          const strong = e.t % (TPE * 3) === 0;
          const top = v.staff === 1 && v.layer === 0;
          let vel = (strong ? 0.86 : 0.62) * (top ? 1 : 0.82) * (v.staff ? 1 : 0.9);
          vel *= 1 + (Math.random() - 0.5) * 0.10 * human;
          if (isLast) vel *= 0.9;

          let dur = (e.dur / ticks) * sec;
          dur *= e.stacc === 2 ? 0.34 : e.stacc === 1 ? 0.55 : e.slurL || e.slurJ ? 1.02 : 0.94;

          const orn = ornaments && e.orn ? realize(e, at, (e.dur / ticks) * sec) : null;
          if (orn) {
            for (const o of orn)
              notes.push({ midi: o.midi, t: o.t, dur: o.dur * 0.9, vel: vel * 0.9, staff: v.staff, bar: bi, ev: e });
            for (let k = 0; k < e.notes.length - 1; k++)
              notes.push({ midi: e.notes[k].midi, t: at, dur, vel, staff: v.staff, bar: bi, ev: e });
          } else {
            for (const n of e.notes)
              notes.push({ midi: n.midi, t: at, dur, vel, staff: v.staff, bar: bi, ev: e });
          }
        }
    t += sec;
  });

  notes.sort((a, b) => a.t - b.t);
  return { notes, bars, length: t };
}

/* 反復のある演奏順。原典の指示 *>[A,A1,A,A2,B] のとおり。
   コーダ（第17小節以降）は後半の続きとして一度だけ通る */
export function playOrder(cells, repeat = true) {
  const A = cells.filter((c) => c.pos <= 7);
  const v0 = cells.find((c) => c.pos === 8 && (c.volta ?? 0) === 0);
  const v1 = cells.find((c) => c.pos === 8 && c.volta === 1) || v0;
  const B = cells.filter((c) => c.pos >= 9);
  return repeat ? [...A, v0, ...A, v1, ...B] : [...A, v1, ...B];
}
