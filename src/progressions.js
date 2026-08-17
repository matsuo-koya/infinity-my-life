/* ══════════════════════════════════════════════════════════════
   1787 ←→ 1965 のダイヤル

   モーツァルト（と署名された誰か）の《音楽のさいころ遊び》K.516f は、
   小節位置ごとに和声上の役目が固定してある。176枚の札を全部測ると、
   16か所中13か所で11の候補が同じ和音を指す。だから賽が何を出しても
   音楽になる。イ長調に移すと、その骨はこうなる。

     A A E A | B7 E B7 E7 | B7 E A E | A A E7 A

   いっぽう1965年10月、ジョージ・マーティンがレノンに
   「バロックっぽいもの」を頼まれて書いたソロが乗っている進行は、
   同じイ長調でこう動く。借用した短調のIV（Dm→A）がよく効く。

     A E F#m A7 | D Dm A A |（8小節を2度）

   この機械は、小節ごとに「どちらの和音を採るか」を賽に決めさせる。
   ただし2つの目のあいだを飛ぶのではなく、両者を結ぶ短い列を作って
   おいて、賽の和がその列のどこを指すかで決める。つまり賽は
   1787年と1965年のあいだのダイヤルを回している。

   2つの賽の和は7がいちばん出やすいので、**この機械はまん中に寄る**。
   混ざったものがいちばん出る、というのがこの設計の要点。

   和音進行そのものに著作権はない。旋律も、マーティンの実際のソロも、
   ここには一切入っていない。骨だけを借りて、肉は毎回あたらしく作る。
   ══════════════════════════════════════════════════════════════ */

export const TONIC = 9;                    /* イ長調 */
export const KEY_SHARPS = 3;               /* 嬰ヘ・嬰ハ・嬰ト */

/* イ長調の綴り。嬰記号の側に寄せる。
   借用和音のために G ナチュラル（A7の第7音）と F ナチュラル（Dm）も要る */
const SPELL = [
  [0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0],
];
export function note(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const [letter, alter] = SPELL[pc];
  const oct = Math.floor((midi - alter) / 12) - 1;
  return { letter, oct, alter, step: oct * 7 + letter, midi };
}

/* 使う和音。pcs は絶対音高階級 */
const ch = (name, ja, root, ivals, bass) => ({
  name, ja, root, bass: bass == null ? root : bass,
  pcs: ivals.map((i) => (root + i) % 12),
});
export const CHORDS = {
  A:    ch("A",    "I",      9,  [0, 4, 7]),
  A7:   ch("A7",   "I7",     9,  [0, 4, 7, 10]),
  Am:   ch("Am",   "i",      9,  [0, 3, 7]),
  E:    ch("E",    "V",      4,  [0, 4, 7]),
  E7:   ch("E7",   "V7",     4,  [0, 4, 7, 10]),
  EoverG: ch("E/G♯", "V6",   4,  [0, 4, 7], 8),
  Fsm:  ch("F♯m",  "vi",     6,  [0, 3, 7]),
  Csm:  ch("C♯m",  "iii",    1,  [0, 3, 7]),
  D:    ch("D",    "IV",     2,  [0, 4, 7]),
  Dm:   ch("Dm",   "iv",     2,  [0, 3, 7]),
  DoverA: ch("D/A", "IV64",  2,  [0, 4, 7], 9),
  AoverCs: ch("A/C♯", "I6",  9,  [0, 4, 7], 1),
  AoverE:  ch("A/E",  "I64", 9,  [0, 4, 7], 4),
  B7:   ch("B7",   "V/V",   11,  [0, 4, 7, 10]),
  Bm7:  ch("Bm7",  "ii7",   11,  [0, 3, 7, 10]),
};

export const BARS = 16;

/* 小節ごとの列。左端が1787年、右端が1965年。
   あいだの1つは、どちらの側から見ても筋の通る和音を置いてある */
export const DIAL = [
  ["A"],                              /*  1  一致 */
  ["A", "AoverE", "E"],               /*  2 */
  ["E", "Csm", "Fsm"],                /*  3 */
  ["A", "A", "A7"],                   /*  4 */
  ["B7", "Bm7", "D"],                 /*  5 */
  ["E", "D", "Dm"],                   /*  6  IV→iv、ビートルズの一手 */
  ["B7", "E", "A"],                   /*  7 */
  ["E7", "E7", "A"],                  /*  8  1番・2番括弧 */
  ["B7", "E", "A"],                   /*  9 */
  ["E"],                              /* 10  一致 */
  ["A", "AoverCs", "Fsm"],            /* 11 */
  ["E", "A", "A7"],                   /* 12 */
  ["A", "DoverA", "D"],               /* 13 */
  ["A", "D", "Dm"],                   /* 14 */
  ["E7", "E7", "A"],                  /* 15 */
  ["A"],                              /* 16  一致 */
];

export const SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const WAYS = SUMS.map((s) => 6 - Math.abs(7 - s));
export const P = WAYS.map((w) => w / 36);
export const roll2 = () => {
  const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
  return { a, b, sum: a + b };
};

/* 賽の和 2–12 を 0（1787）から 1（1965）へ写す */
export const dialOf = (sum) => (sum - 2) / 10;
/* その小節で、その目が指す和音 */
export function pick(bar, sum) {
  const list = DIAL[bar];
  const i = Math.min(list.length - 1, Math.round(dialOf(sum) * (list.length - 1)));
  return { key: list[i], era: list.length === 1 ? "both" : i === 0 ? "1787" : i === list.length - 1 ? "1965" : "mix" };
}
export const pathOf = (sums) => sums.map((s, i) => ({ bar: i + 1, sum: s, ...pick(i, s) }));

/* この機械の広さ。小節ごとの選択肢の積 */
export const TOTAL = DIAL.reduce((n, l) => n * BigInt(l.length), 1n);
/* 出目1回ぶんの情報量と、16回ぶんの実質 */
export const H_ROLL = -P.reduce((s, p) => s + p * Math.log2(p), 0);
/* 両者が最初から一致している小節 */
export const AGREED = DIAL.filter((l) => l.length === 1).length;

/* 番地。16個の出目そのもの */
export const codeOf = (sums) => sums.map((s) => s.toString(36)).join("");
export const decodeCode = (str) => {
  if (!/^[2-9a-c]{16}$/.test(str)) return null;
  const out = [...str].map((c) => parseInt(c, 36));
  return out.every((n) => n >= 2 && n <= 12) ? out : null;
};

/* どちらへ寄ったかの目盛り。0 = 1787、1 = 1965 */
export const leaning = (sums) =>
  sums.reduce((a, s) => a + dialOf(s), 0) / Math.max(1, sums.length);

/* ─── 骨の書き出し ───────────────────────────────
   旋律の芯と低音を、和音の並びから声部連結で引く。
   元の機械では原典の札から抜き出していたが、こちらは進行しかないので作る */

const inChord = (pcs, m) => pcs.includes(((m % 12) + 12) % 12);
export function snap(pcs, m, dir = 0) {
  if (dir === 0) {
    for (let d = 0; d < 7; d++) {
      if (inChord(pcs, m - d)) return m - d;
      if (inChord(pcs, m + d)) return m + d;
    }
    return m;
  }
  for (let d = 0; d < 13; d++) if (inChord(pcs, m + dir * d)) return m + dir * d;
  return m;
}
export function step(pcs, m, dir) {
  for (let d = 1; d < 13; d++) if (inChord(pcs, m + dir * d)) return m + dir * d;
  return m + dir * 12;
}
export function ladder(pcs, from, n, dir = 1, lo = 40, hi = 86) {
  let m = snap(pcs, Math.max(lo, Math.min(hi, from)), dir);
  const out = [m];
  for (let i = 1; i < n; i++) {
    const nx = step(pcs, out[i - 1], dir);
    out.push(nx > hi || nx < lo ? step(pcs, out[i - 1], -dir) : nx);
  }
  return out;
}

/* 進行から、1小節に3点の旋律の芯と低音を引く。
   前の音のいちばん近くへ動かす（声部連結）。頂点は8小節目あたりに置く */
export function skeleton(path) {
  const out = [];
  let prev = 73;                                    /* 出だしは嬰ハの上あたり */
  path.forEach((p, i) => {
    const c = CHORDS[p.key];
    /* 8小節目あたりを頂点にした弓なり。旋律はそこへ向かって寄っていく */
    const arch = Math.sin((i / (path.length - 1)) * Math.PI) * 6;
    const target = 71 + Math.round(arch);
    /* 前の音から動きすぎないように、目標へは3半音ずつ寄せる */
    const gap = target - prev;
    const a = snap(c.pcs, prev + Math.sign(gap) * Math.min(4, Math.abs(gap)), 0);
    const dir = i % 2 ? 1 : -1;
    const b = step(c.pcs, a, dir);
    const d = step(c.pcs, b, a > 76 ? -1 : a < 66 ? 1 : -dir);
    const mel = [a, b, d].map((m) => Math.max(64, Math.min(86, m)));
    prev = mel[2];
    const bassRoot = 45 + ((c.bass - 9 + 12) % 12);   /* イ2 のあたりを底に */
    out.push({ chord: p.key, era: p.era, sum: p.sum, mel, bass: [bassRoot, bassRoot, bassRoot], bassMidi: bassRoot });
  });
  return out;
}
