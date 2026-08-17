/* ══════════════════════════════════════════════════════════════
   音型 — 二つの語彙

   1787年の側（モーツァルトの図形変奏）
     3/8拍子。8分を2つに割った16分で、旋律の芯のまわりを回る。
     左手はブンチャッチャ。フレーズは小節で区切れる。

   1965年の側（マーティンのバロック模倣）
     4/4拍子。16分が途切れずに流れ、小節線を越えて続く。
     和声音と経過音を交互に踏む、いわゆるバロックの走句。
     左手は薄い。終止には短いモルデントを置く。
     そして——ゆっくり弾いて倍速で戻すので、間合いが平らになる。

   どちらの語彙を使うかは、変奏ごとに賽が決める。
   ══════════════════════════════════════════════════════════════ */

import { note, CHORDS, snap, step, ladder, dialOf } from "./progressions.js";

export const TPE = 24;                     /* 8分音符あたりの刻み */
export const M38 = TPE * 3;                /* 3/8 の1小節 */
export const M44 = TPE * 8;                /* 4/4 の1小節 */
const S16 = TPE / 2;                       /* 16分 */

const LOW = 40, HIGH = 86;
const fit = (m, lo = LOW, hi = HIGH) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };

/* イ長調と、同主短調（和声的短音階） */
export const SCALE_MAJ = [9, 11, 1, 2, 4, 6, 8];
export const SCALE_MIN = [9, 11, 0, 2, 4, 5, 8];
const inSet = (set, m) => set.includes(((m % 12) + 12) % 12);
function stepScale(scale, m, dir) {
  for (let d = 1; d < 4; d++) if (inSet(scale, m + dir * d)) return m + dir * d;
  return m + dir * 2;
}

/* ─── 小節を組む ─── */
export const newBar = (ticks, volta = 0) => ({ volta, ticks, staves: [[], []] });
export function put(w, staff, li, t, dur, midis, opts = {}) {
  const st = w.staves[staff];
  while (st.length <= li) st.push({ staff, layer: st.length, t: 0, ev: [] });
  const v = st[li];
  const e = {
    t, dur, rest: midis.length === 0,
    notes: midis.slice().sort((a, b) => a - b).map(note),
    beamL: 0, beamJ: 0, orn: null, stacc: 0, slurL: 0, slurJ: 0, ...opts,
  };
  v.ev.push(e); v.t = Math.max(v.t, t + dur);
  return e;
}
export function beam(evs, tuplet) {
  if (evs.length < 2) return evs;
  evs[0].beamL = 1; evs[evs.length - 1].beamJ = 1;
  if (tuplet) evs[0].tuplet = tuplet;
  return evs;
}

/* 伴奏の和音。低音より上、旋律の下 */
function pad(pcs, bass, hi = 64) {
  const out = [];
  let m = snap(pcs, Math.max(bass + 7, 50), 1);
  while (out.length < 2 && m <= hi) { out.push(m); m = step(pcs, m, 1); }
  return out.length ? out : [snap(pcs, 55, 1)];
}
/* 1787の左手。ブンチャッチャ */
function laendler(w, pcs, bass) {
  const c = pad(pcs, bass);
  put(w, 0, 0, 0, TPE, [bass]);
  put(w, 0, 0, TPE, TPE, c);
  put(w, 0, 0, TPE * 2, TPE, c);
}
/* 1965の左手。薄く、1拍目と3拍目だけ */
function sparse(w, pcs, bass) {
  const c = pad(pcs, bass, 62);
  put(w, 0, 0, 0, TPE * 2, [bass]);
  put(w, 0, 0, TPE * 2, TPE * 2, c);
  put(w, 0, 0, TPE * 4, TPE * 2, [bass + 12 <= 60 ? bass + 12 : bass]);
  put(w, 0, 0, TPE * 6, TPE * 2, c);
}

/* ─── バロックの走句 ───────────────────────────────
   4つで一組。和声音・経過音・和声音・経過音と踏む。
   マーティンのソロが「バッハっぽい」のは、だいたいこの足取りのため */
function run4(pcs, scale, from, dir) {
  const a = snap(pcs, from, 0);
  const b = stepScale(scale, a, dir);
  const c = step(pcs, b, dir);
  const d = stepScale(scale, c, dir);
  return [a, b, c, d];
}
/* n個ぶん続けて走る。天井と床で向きを変える。
   音域は手ごとに違うので外から渡す。ここで畳んでしまうと
   走句の途中にオクターヴの跳躍が生まれて、足取りが崩れる */
function runLine(pcs, scale, from, n, dir0 = 1, lo = 60, hi = HIGH) {
  const out = [];
  let m = snapScale(scale, Math.max(lo + 2, Math.min(hi - 2, from)));
  let dir = dir0;
  /* 1音ずつ進み、端に着く手前で向きを変える。
     あとから畳むとオクターヴの跳躍が混ざって足取りが崩れるので、
     はみ出させないほうを選ぶ */
  for (let i = 0; i < n; i++) {
    out.push(m);
    /* 和声音と経過音を交互に踏むのがバロックの走句 */
    let nx = (i % 2 === 0) ? stepScale(scale, m, dir) : step(pcs, m, dir);
    if (nx > hi || nx < lo) { dir = -dir; nx = stepScale(scale, m, dir); }
    if (nx > hi || nx < lo) nx = m;
    m = nx;
  }
  return out;
}

/* ─── 音型それぞれ ───────────────────────────────
   b は骨、i は小節番号、ctx は { minor, scale, prev, cadence } */

/* 主題。素のまま示す */
function thema1787(b, i, ctx) {
  const w = newBar(M38);
  const pcs = CHORDS[b.chord].pcs;
  put(w, 1, 0, 0, TPE, [b.mel[0]]);
  put(w, 1, 0, TPE, TPE, [b.mel[1]]);
  put(w, 1, 0, TPE * 2, TPE, [b.mel[2]]);
  laendler(w, pcs, b.bassMidi);
  return w;
}
function thema1965(b, i, ctx) {
  const w = newBar(M44);
  const pcs = CHORDS[b.chord].pcs;
  put(w, 1, 0, 0, TPE * 3, [b.mel[0]]);
  put(w, 1, 0, TPE * 3, TPE, [b.mel[1]]);
  put(w, 1, 0, TPE * 4, TPE * 2, [b.mel[2]]);
  put(w, 1, 0, TPE * 6, TPE * 2, [b.mel[1]]);
  sparse(w, pcs, b.bassMidi);
  return w;
}

/* 走句 */
function run1787(b, i, ctx) {
  const w = newBar(M38);
  const pcs = CHORDS[b.chord].pcs;
  const dir = i % 2 ? 1 : -1;
  const g = [];
  for (let k = 0; k < 3; k++) {
    const top = snap(pcs, b.mel[k], 0);
    g.push(put(w, 1, 0, k * TPE, S16, [top]));
    g.push(put(w, 1, 0, k * TPE + S16, S16, [step(pcs, top, dir)]));
  }
  beam(g);
  laendler(w, pcs, b.bassMidi);
  return w;
}
function run1965(b, i, ctx) {
  const w = newBar(M44);
  const pcs = CHORDS[b.chord].pcs;
  /* 前の小節の終わりから続ける。切れ目をつくらないのが1965の側の肝 */
  const from = ctx.carry ?? b.mel[0];
  const line = runLine(pcs, ctx.scale, from, 16, i % 2 ? 1 : -1, 60, HIGH);
  for (let k = 0; k < 4; k++)
    beam(line.slice(k * 4, k * 4 + 4).map((m, j) => put(w, 1, 0, (k * 4 + j) * S16, S16, [m])));
  ctx.carry = stepScale(ctx.scale, line[15], 1);
  if (ctx.cadence) w.staves[1][0].ev[15].orn = "mordent";
  sparse(w, pcs, b.bassMidi);
  return w;
}

/* 続進。ひとつの音型を、和音を渡りながら繰り返す */
function seq1787(b, i, ctx) {
  const w = newBar(M38);
  const pcs = CHORDS[b.chord].pcs;
  const d = TPE / 3;
  for (let k = 0; k < 3; k++) {
    const up = ladder(pcs, fit(b.mel[k] - 9, 58, 74), 3, 1, 52, 84);
    beam(up.map((m, j) => put(w, 1, 0, k * TPE + j * d, d, [m], { beams: 2 })), 3);
  }
  laendler(w, pcs, b.bassMidi);
  return w;
}
function seq1965(b, i, ctx) {
  const w = newBar(M44);
  const pcs = CHORDS[b.chord].pcs;
  /* 4音の型を、1小節に4回。上へ下へと一段ずつずらす */
  /* 型が音域から出ないよう、起点そのものを内側に留める。
     畳んでしまうと続進の足取りにオクターヴの段差が入る */
  let m = Math.max(60, Math.min(76, ctx.carry ?? b.mel[0]));
  for (let k = 0; k < 4; k++) {
    const dir = k % 2 ? -1 : 1;
    const g = [snap(pcs, m, 0), step(pcs, m, 1), snap(pcs, m, 0), stepScale(ctx.scale, m, -1)];
    beam(g.map((x, j) => put(w, 1, 0, (k * 4 + j) * S16, S16, [Math.max(55, Math.min(HIGH, x))])));
    const nx = stepScale(ctx.scale, m, dir);
    m = nx > 78 || nx < 58 ? stepScale(ctx.scale, m, -dir) : nx;
  }
  ctx.carry = m;
  sparse(w, pcs, b.bassMidi);
  return w;
}

/* 左手へ移す */
function left1787(b, i, ctx) {
  const w = newBar(M38);
  const pcs = CHORDS[b.chord].pcs;
  const low = b.bassMidi;
  const up = ladder(pcs, low, 3, 1, 36, 64);
  beam([low, up[1], up[2], up[1], up[2], up[1]]
    .map((m, k) => put(w, 0, 0, k * S16, S16, [m])));
  put(w, 1, 0, 0, TPE, [b.mel[0], b.mel[0] - 12]);
  put(w, 1, 0, TPE, TPE, [b.mel[1]]);
  put(w, 1, 0, TPE * 2, TPE, [b.mel[2]]);
  return w;
}
function left1965(b, i, ctx) {
  const w = newBar(M44);
  const pcs = CHORDS[b.chord].pcs;
  const line = runLine(pcs, ctx.scale, ctx.carryL ?? b.bassMidi + 12, 16, 1, 40, 64);
  for (let k = 0; k < 4; k++)
    beam(line.slice(k * 4, k * 4 + 4).map((m, j) => put(w, 0, 0, (k * 4 + j) * S16, S16, [m])));
  ctx.carryL = line[15];
  put(w, 1, 0, 0, TPE * 4, [b.mel[0]]);
  put(w, 1, 0, TPE * 4, TPE * 4, [b.mel[2]]);
  return w;
}

/* 多様な奏法 ───────────────────────────────
   マーティンのソロは、同じ音型を延々と繰り返してはいない。
   隣の音との小さな揺れから始まる動機があり、トリルが所々に混じり、
   走り下り（ランダウン）と組み合わさる。しかもそれを左右の手で
   交互に受け渡す。だから1曲のあいだ耳が飽きない。

   主動機は「ミレミドレドレ」。音階度でいうと 3 2 3 1 2 1 2 で、
   隣の音へ行って戻る揺れを置き、一段下りて、また揺れる形。
   七つで一区切りという半端な長さが、かえって前へ進む力になる。
   バロックの手鍵盤ものによく出る足取りでもある。

   小節ごとに身ぶりを取り替える。
     ① 動機 ＋ 走り下り
     ② モルデント（一度だけ返す）＋ 走句
     ③ 走り下り
     ④ 左右交互（4つずつ受け渡す）
   終止の小節（8と16）では必ず装飾を置く。古典派の作法でもある */

/* ミレミドレドレ。起点の音からの音階度 */
const MOTIF = [2, 1, 2, 0, 1, 0, 1];

/* いちばん近い音階音。動機の起点は音階の上に載っていないといけない */
function snapScale(scale, m) {
  for (let d = 0; d < 7; d++) {
    if (inSet(scale, m - d)) return m - d;
    if (inSet(scale, m + d)) return m + d;
  }
  return m;
}
/* 音階を n 段のぼった音 */
function degAbove(scale, from, n) {
  let m = snapScale(scale, from);
  for (let i = 0; i < n; i++) m = stepScale(scale, m, 1);
  return m;
}
/* 音階を dir 向きに n 個。走り下りの中身 */
function scaleRun(scale, from, n, dir) {
  const out = [snapScale(scale, from)];
  for (let i = 1; i < n; i++) {
    const nx = stepScale(scale, out[i - 1], dir);
    out.push(nx < 45 || nx > HIGH ? out[i - 1] : nx);      /* 端では畳まず留まる */
  }
  return out;
}
/* 拍に合わせて束ねる。4/4は4つずつ、3/8は6つまとめて（原典の作法）。
   途中から置くときも、束の切れ目は小節の頭から数えた拍の境に合わせる */
function lay(w, staff, base, notes, from = 0, group = 4) {
  let k = 0;
  while (k < notes.length) {
    const abs = from + k;
    const len = Math.min(group - (abs % group), notes.length - k);
    beam(notes.slice(k, k + len).map((m, j) => put(w, staff, 0, base + (abs + j) * S16, S16, [m])));
    k += len;
  }
}

/* 休符で埋める。書ける長さに割ってから並べる */
function restFill(w, staff, at, len) {
  for (const d of [96, 48, 24, 12]) while (len >= d) { put(w, staff, 0, at, d, []); at += d; len -= d; }
}

function varied(b, i, ctx) {
  const wide = ctx.era === "1965";
  const T = wide ? M44 : M38;
  const n16 = T / S16;                     /* 1小節ぶんの16分の数。4/4なら16、3/8なら6 */
  const w = newBar(T);
  const pcs = CHORDS[b.chord].pcs;
  const scale = ctx.scale;
  const g = ctx.cadence ? 1 : i % 4;
  const top = snap(pcs, Math.max(b.mel[0], 69), 0);

  const group = wide ? 4 : 6;
  if (g === 0) {
    /* ① 動機、そのあと走り下り。つないでから拍で束ねる */
    const startDeg = fit(top - 4, 62, 76);
    const cell = MOTIF.slice(0, Math.min(MOTIF.length, n16)).map((d) => degAbove(scale, startDeg, d));
    /* 動機のあとの走り下りも、下まで届いたら左手へ渡す */
    const tail = n16 > cell.length
      ? scaleRun(scale, fit(cell[0] + 12, 72, HIGH), n16 - cell.length, -1) : [];
    const all = [...cell, ...tail];
    let cut = all.findIndex((m, k) => k >= cell.length && m < 60);
    if (cut < 0) cut = all.length;
    lay(w, 1, 0, all.slice(0, cut), 0, group);
    if (cut < all.length) {
      restFill(w, 1, cut * S16, T - cut * S16);
      restFill(w, 0, 0, cut * S16);
      lay(w, 0, 0, all.slice(cut).map((m) => m - 12), cut, group);
      ctx.carry = all[cut - 1];
      return w;
    }
    ctx.carry = all[all.length - 1];
  } else if (g === 1) {
    /* ② 一度だけ返して伸ばし（ミドミー）、残りを走句で埋める */
    const hold = wide ? TPE * 4 : TPE * 2;
    put(w, 1, 0, 0, hold, [top], { orn: "trill" });
    const n = (T - hold) / S16;
    const line = runLine(pcs, scale, stepScale(scale, top, -1), n, -1, 60, HIGH);
    lay(w, 1, hold, line, 0, group);
    ctx.carry = line[n - 1];
  } else if (g === 2) {
    /* ③ 走り下り。右手が高いところから駆け下り、途中で左手が受け取って
       さらに下へ抜ける。片手で降りきるより、ずっと遠くまで行ける */
    /* 出だしの高さ。fit で畳むと下へ落ちてしまうので、ここは頭打ちで留める。
       両手にほぼ半分ずつ渡るあたりを狙う */
    const seed = wide ? Math.max(74, Math.min(80, top + 8)) : Math.max(70, Math.min(78, top + 7));
    const line = scaleRun(scale, seed, n16, -1);
    let cut = line.findIndex((m) => m < 60);
    if (cut < 2) cut = Math.ceil(n16 / 2);              /* 短くて跨がないときは真ん中で渡す */
    const right = line.slice(0, cut);
    const left = line.slice(cut).map((m) => (m >= 60 ? m - 12 : m));
    lay(w, 1, 0, right, 0, group);
    restFill(w, 1, cut * S16, T - cut * S16);
    restFill(w, 0, 0, cut * S16);
    lay(w, 0, 0, left, cut, group);
    ctx.carry = right[right.length - 1];
    return w;                                           /* 両手が走るので伴奏は置かない */
  } else {
    /* ④ 左右交互。動機を4つ（3/8なら3つ）ずつ受け渡す */
    const chunk = wide ? 4 : 3;
    const groups = n16 / chunk;
    const cell = MOTIF.map((d) => degAbove(scale, fit(top - 4, 62, 76), d));
    const src = wide
      ? cell.concat(scaleRun(scale, stepScale(scale, cell[cell.length - 1], 1), n16 - cell.length, -1))
      : cell.slice(0, n16);
    for (let k = 0; k < groups; k++) {
      const right = k % 2 === 0;
      const staff = right ? 1 : 0;
      const notes = src.slice(k * chunk, k * chunk + chunk)
        .map((m) => (right ? fit(m, 62, HIGH) : fit(m - 24, 40, 60)));
      beam(notes.map((m, j) => put(w, staff, 0, (k * chunk + j) * S16, S16, [m])));
      /* 休んでいるほうの手は、そのぶん休符を置く */
      restFill(w, right ? 0 : 1, k * chunk * S16, chunk * S16);
    }
    ctx.carry = src[src.length - 1];
    return w;                              /* この身ぶりでは伴奏を置かない */
  }

  if (wide) sparse(w, pcs, b.bassMidi); else laendler(w, pcs, b.bassMidi);
  return w;
}

/* フガート ───────────────────────────────
   「ミレミドレドドレ」は主題としてよくできている。順次進行で覚えやすく、
   一段ずらしても、上下ひっくり返しても形が保たれる。
   そこで二声のフガートにする。右手が主題を出し、左手が四度下で答え、
   その間じゅう反対の手は対主題（走句）を弾きつづける。

   マーティンが真似ていたのはバッハで、この機械が拾ったのもバッハだった。
   まわり道をして同じところへ出た、ということだと思う */

function fugato(b, i, ctx) {
  const wide = ctx.era === "1965";
  const T = wide ? M44 : M38;
  const n16 = T / S16;
  const w = newBar(T);
  const pcs = CHORDS[b.chord].pcs;
  const scale = ctx.scale;
  const sub = Math.min(MOTIF.length, n16);            /* 主題の長さ。七つ */
  const group = wide ? 4 : 6;
  const phase = i % 4;

  /* その手を、主題／対主題／休みのどれにするか */
  const RANGE = { 1: [60, HIGH], 0: [40, 64] };
  /* 主題を出し、余りを対主題で埋める。つないでから拍で束ねる */
  const entry = (staff, start) => {
    const [lo, hi] = RANGE[staff];
    const cell = MOTIF.slice(0, sub).map((d) => degAbove(scale, start, d));
    const n = n16 - cell.length;
    const tail = n > 0
      ? runLine(pcs, scale, stepScale(scale, cell[cell.length - 1], staff ? -1 : 1), n, staff ? -1 : 1, lo, hi)
      : [];
    lay(w, staff, 0, [...cell, ...tail], 0, group);
    return (tail.length ? tail : cell)[(tail.length ? tail : cell).length - 1];
  };
  const counter = (staff, seed) => {
    const [lo, hi] = RANGE[staff];
    const line = runLine(pcs, scale, seed, n16, staff ? -1 : 1, lo, hi);
    lay(w, staff, 0, line, 0, group);
    return line[n16 - 1];
  };
  const hush = (staff, at, len) => restFill(w, staff, at, len);

  const head = snapScale(scale, snap(pcs, fit(b.mel[0] - 4, 64, 76), 0));
  /* 応答は四度下（五度上の1オクターヴ下）。主題が天井に当たらない高さに置く */
  const low = snapScale(scale, Math.max(45, Math.min(56, degAbove(scale, head, 4) - 12)));

  if (phase === 0) {
    /* 提示。右手だけが主題を出す */
    entry(1, head);
    hush(0, 0, T);
  } else if (phase === 1) {
    /* 応答。左手が四度下で入り、右手は対主題を続ける */
    entry(0, low);
    counter(1, ctx.carry ?? head);
  } else {
    /* 嬉遊部。両手が反対向きに走る */
    counter(1, ctx.carry ?? head);
    counter(0, low);
  }
  ctx.carry = head;
  return w;
}

/* 同主短調。イ短調へ */
function minore(b, i, ctx) {
  const era = ctx.era;
  const w = newBar(era === "1965" ? M44 : M38);
  const base = CHORDS[b.chord];
  /* 長三和音を短三和音に読み替える。属和音だけは導音を残す */
  const isDom = base.name === "E" || base.name === "E7" || base.name === "B7";
  const pcs = isDom ? base.pcs : base.pcs.map((p) => ((p - base.root + 12) % 12 === 4 ? (p + 11) % 12 : p));
  if (era === "1965") {
    const line = runLine(pcs, SCALE_MIN, ctx.carry ?? b.mel[0], 16, i % 2 ? 1 : -1, 60, HIGH);
    for (let k = 0; k < 4; k++)
      beam(line.slice(k * 4, k * 4 + 4).map((m, j) => put(w, 1, 0, (k * 4 + j) * S16, S16, [m])));
    ctx.carry = line[15];
    sparse(w, pcs, b.bassMidi);
  } else {
    const g = [];
    for (let k = 0; k < 3; k++) {
      const top = snap(pcs, b.mel[k], 0);
      g.push(put(w, 1, 0, k * TPE, S16, [top]));
      g.push(put(w, 1, 0, k * TPE + S16, S16, [stepScale(SCALE_MIN, top, -1)]));
    }
    beam(g);
    put(w, 0, 0, 0, TPE * 2, [b.bassMidi]);
    put(w, 0, 0, TPE * 2, TPE, pad(pcs, b.bassMidi));
  }
  return w;
}

/* 終曲 */
function fin1787(b, i, ctx) {
  const w = newBar(TPE * 6);                        /* 6/8 */
  const pcs = CHORDS[b.chord].pcs;
  for (const half of [0, 1]) {
    const base = half * TPE * 3;
    const up = ladder(pcs, fit(b.mel[half ? 2 : 0] - 12, 55, 72), 4, 1, 52, 84);
    beam([...up, up[2], up[1]].map((m, j) => put(w, 1, 0, base + j * S16, S16, [m])));
    const c = pad(pcs, b.bassMidi);
    put(w, 0, 0, base, TPE, [b.bassMidi]);
    put(w, 0, 0, base + TPE, TPE, c);
    put(w, 0, 0, base + TPE * 2, TPE, c);
  }
  return w;
}
function fin1965(b, i, ctx) {
  const w = newBar(M44);
  const pcs = CHORDS[b.chord].pcs;
  const line = runLine(pcs, ctx.scale, ctx.carry ?? b.mel[0], 16, 1, 60, HIGH);
  for (let k = 0; k < 4; k++)
    beam(line.slice(k * 4, k * 4 + 4).map((m, j) => put(w, 1, 0, (k * 4 + j) * S16, S16, [m])));
  ctx.carry = stepScale(ctx.scale, line[15], 1);
  if (ctx.cadence) w.staves[1][0].ev[15].orn = "mordent";
  const c = pad(pcs, b.bassMidi, 62);
  put(w, 0, 0, 0, TPE, [b.bassMidi]);
  put(w, 0, 0, TPE, TPE, c);
  put(w, 0, 0, TPE * 2, TPE, [b.bassMidi]);
  put(w, 0, 0, TPE * 3, TPE, c);
  put(w, 0, 0, TPE * 4, TPE, [b.bassMidi]);
  put(w, 0, 0, TPE * 5, TPE, c);
  put(w, 0, 0, TPE * 6, TPE, [b.bassMidi]);
  put(w, 0, 0, TPE * 7, TPE, c);
  return w;
}

/* コーダ。主音の上でひと息ついて閉じる */
function coda(skel, era, scale) {
  const T = era === "1965" ? M44 : TPE * 6;
  const pI = CHORDS.A.pcs, pV = CHORDS.E7.pcs;
  const mk = (pcs, bass, last) => {
    const w = newBar(T);
    if (last) {
      const top = snap(pcs, 73, 0);
      put(w, 1, 0, 0, T / 2, [top, top - 12]);
      put(w, 1, 0, T / 2, T / 2, []);
      put(w, 0, 0, 0, T / 2, [bass, bass + 12]);
      put(w, 0, 0, T / 2, T / 2, []);
      return w;
    }
    const n = T / S16;
    const line = runLine(pcs, scale, 64, n, 1, 58, 84);
    for (let k = 0; k < n / 4; k++)
      beam(line.slice(k * 4, k * 4 + 4).map((m, j) => put(w, 1, 0, (k * 4 + j) * S16, S16, [m])));
    put(w, 0, 0, 0, T / 2, [bass]);
    put(w, 0, 0, T / 2, T / 2, pad(pcs, bass));
    return w;
  };
  return [mk(pI, 45, false), mk(pV, 40, false), mk(pI, 45, false), mk(pI, 45, true)];
}

/* ─── 楽章の一覧 ───────────────────────────────
   語彙・拍子・半速録音の有無は、賽が決める（下の plan を見よ） */
export const MOVEMENTS = [
  { key: "thema", ja: "主題", note: "進行をそのまま示す", tempo: 1, gen: { "1787": thema1787, "1965": thema1965 } },
  { key: "run", ja: "第1変奏", note: "走句", tempo: 1, gen: { "1787": run1787, "1965": run1965 } },
  { key: "seq", ja: "第2変奏", note: "続進", tempo: 1.02, gen: { "1787": seq1787, "1965": seq1965 } },
  { key: "left", ja: "第3変奏", note: "左手へ", tempo: 1.05, gen: { "1787": left1787, "1965": left1965 } },
  { key: "varied", ja: "第4変奏", note: "動機・モルデント・走り下り・左右交互", tempo: 1.06, gen: { "1787": varied, "1965": varied } },
  { key: "fugato", ja: "第5変奏", note: "フガート — 四度下の応答", tempo: 1.1, gen: { "1787": fugato, "1965": fugato } },
  { key: "minore", ja: "第6変奏", note: "同主短調", tempo: 1.2, gen: { "1787": minore, "1965": minore } },
  { key: "finale", ja: "終曲", note: "コーダつき", tempo: 0.66, gen: { "1787": fin1787, "1965": fin1965 } },
];

/* 変奏ごとの性格。出目そのものから決めるので、番地が同じなら中身も同じ */
export function plan(sums) {
  return MOVEMENTS.map((m, k) => {
    const s = sums[(k * 3 + 1) % sums.length] ?? 7;
    const d = dialOf(s);
    /* まん中（和が7）は1787の側に倒す。和声のダイヤルと違って語彙は二択なので、
       楽章ごとに別の目を引かせることで、一巡すると両方が混ざるようにしてある */
    const era = d <= 0.5 ? "1787" : "1965";
    return {
      ...m, index: k, sum: s, dial: d, era,
      /* 1965年へ寄るほど、テープを回したくなる */
      varispeed: d >= 0.7 && m.key !== "thema",
      meter: era === "1965" ? [4, 4] : m.key === "finale" ? [6, 8] : [3, 8],
      minor: m.key === "minore",
    };
  });
}

/* k番目の楽章を組み立てる */
export function build(k, skel, sums) {
  const P = plan(sums)[k];
  const scale = P.minor ? SCALE_MIN : SCALE_MAJ;
  const ctx = { era: P.era, scale, minor: P.minor, carry: null, carryL: null, echo: null };
  const gen = P.gen[P.era];
  const bars = skel.map((b, i) => {
    ctx.prev = skel[i - 1];
    ctx.cadence = i === 7 || i === 15;
    return gen(b, i, ctx);
  });

  const cells = [];
  for (let i = 0; i < 16; i++) {
    if (i === 7) {
      ctx.prev = skel[6]; ctx.cadence = true;
      const second = gen(skel[7], 7, ctx);
      bars[7].volta = 0; second.volta = 1;
      cells.push({ pos: 8, volta: 0, written: bars[7] }, { pos: 8, volta: 1, written: second });
    } else cells.push({ pos: i + 1, volta: 0, written: bars[i] });
  }

  const per = P.era === "1965" ? 4 : 8;
  let rows = P.era === "1965" ? [4, 5, 4, 4] : [8, 9];
  if (P.key === "finale") {
    coda(skel, P.era, scale).forEach((w, j) => cells.push({ pos: 17 + j, volta: 0, written: w, coda: true }));
    rows = P.era === "1965" ? [4, 5, 4, 4, 4] : [8, 9, 4];
  }
  return { ...P, cells, rows, keyN: P.minor ? 0 : 3, sharps: !P.minor };
}
