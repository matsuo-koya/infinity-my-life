/* ══════════════════════════════════════════════════════════════
   音づくり — 1780年代のウィーンの音を、標本を使わずに組み立てる

   ・フォルテピアノ（アントン・ヴァルター 1785 あたりを目安に）
     モーツァルトが自宅に置いていた種類の楽器。現代のピアノより
     はるかに減衰が速く、低音は痩せ、高音は硬く鳴る。倍音を数本
     重ね、上の倍音ほど速く消すことでその手触りに寄せる。
   ・自鳴琴（フレーテンウーア）
     モーツァルトが実際に曲を書いた（K.594・K.608・K.616）自動
     オルガン時計。歯車が回れば人がいなくてもひとりでに鳴る。
     賽で作った曲を鳴らすには、いちばんふさわしい楽器だと思う。

   音律と基準音高も選べる。当時のウィーンは a′ = 421.6Hz あたり。
   ══════════════════════════════════════════════════════════════ */

/* ─── 音律 ───────────────────────────────
   平均律からのずれ（セント）。ハを基準に12音ぶん */
const meantone = (frac) => {
  /* 純正五度から 1/frac コンマだけ狭めた五度を、変ホから嬰トまで積む。
     残る変ホ—嬰ト間の五度が「狼」になる。そこを通る調は使えない */
  const fifth = 701.955 - 21.5063 / frac;
  const out = new Array(12).fill(0);
  for (let i = -3; i <= 8; i++) {
    const pc = ((i * 7) % 12 + 12) % 12;
    let d = ((i * fifth) % 1200 + 1200) % 1200 - pc * 100;
    while (d > 600) d -= 1200;
    while (d < -600) d += 1200;
    out[pc] = d;
  }
  return out;
};

export const TEMPERAMENTS = {
  equal: { ja: "十二平均律", en: "Equal", year: "", cents: new Array(12).fill(0) },
  kirnberger3: {
    ja: "キルンベルガー III", en: "Kirnberger III", year: "1779",
    cents: [0, -9.8, -6.8, -2.9, -13.7, 2.0, -11.7, -3.4, -7.8, -10.3, -1.0, -11.7],
  },
  vallotti: {
    ja: "ヴァロッティ", en: "Vallotti", year: "1754",
    cents: [5.9, 0, 2.0, 3.9, -2.0, 7.8, -2.0, 3.9, 2.0, 0, 5.9, -3.9],
  },
  meantone6: {
    ja: "中全音律（1/6コンマ）", en: "1/6-comma meantone", year: "",
    cents: meantone(6),
  },
};

export const PITCHES = [
  { hz: 421.6, ja: "a′ = 421.6 Hz", note: "ウィーン 1780年代" },
  { hz: 430, ja: "a′ = 430 Hz", note: "古典派の中ほど" },
  { hz: 440, ja: "a′ = 440 Hz", note: "現代" },
];

export const freqOf = (midi, tempKey, a4) => {
  const t = TEMPERAMENTS[tempKey] || TEMPERAMENTS.equal;
  const pc = ((midi % 12) + 12) % 12;
  /* イ（pc=9）を基準音にそろえる。表はハ基準なので、その差を引く */
  const cents = t.cents[pc] - t.cents[9];
  return a4 * Math.pow(2, (midi - 69) / 12 + cents / 1200);
};

/* ─── 発音体 ─────────────────────────────── */

export const INSTRUMENTS = {
  fortepiano: { ja: "フォルテピアノ", en: "Fortepiano", note: "A. Walter, Wien c.1785（合成）" },
  floetenuhr: { ja: "自鳴琴", en: "Flötenuhr", note: "Orgelwalze in einer Uhr（合成）" },
  salamander: {
    ja: "サンプラー", en: "Salamander Grand Piano",
    note: "Salamander Grand Piano V3（標本）— 録音 Alexander Holm、CC BY 3.0",
    sampled: true,
  },
};

/* フォルテピアノ1音。倍音を数本重ね、上ほど速く消す */
function strike(ac, out, f, t0, dur, vel) {
  const bright = Math.min(1, 0.35 + vel * 0.8);
  /* 音域で性格を変える。高いほど硬く短く、低いほど長く残る */
  const oct = Math.log2(f / 261.63);
  const ring = Math.max(0.45, 3.6 * Math.pow(0.62, oct)) * (0.7 + vel * 0.5);
  const parts = [
    [1, 1.00, 1.00], [2, 0.42 * bright, 0.62], [3, 0.20 * bright, 0.46],
    [4, 0.12 * bright, 0.35], [5, 0.06 * bright, 0.28], [7, 0.03 * bright, 0.20],
  ];
  const B = 0.00028;                                   /* 弦の硬さによる倍音のずれ */
  const nodes = [];
  for (const [n, amp, decay] of parts) {
    const fn = f * n * Math.sqrt(1 + B * n * n);
    if (fn > ac.sampleRate * 0.46) continue;
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = fn;
    /* 2本の弦がわずかにずれて鳴る（ウナ・コルダではない普通の状態） */
    o.detune.value = (n % 2 ? 1 : -1) * 1.4;
    const g = ac.createGain();
    const a = amp * vel * 0.16;
    const rel = ring * decay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(a, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, a * 0.28), t0 + rel * 0.22);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + rel);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + rel + 0.05);
    nodes.push(o, g);
  }
  /* 撥（ハンマー）の当たる音。ごく短い雑音 */
  const nb = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.03), ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const ns = ac.createBufferSource(); ns.buffer = nb;
  const nf = ac.createBiquadFilter();
  nf.type = "bandpass"; nf.frequency.value = Math.min(6000, f * 5); nf.Q.value = 0.7;
  const ng = ac.createGain(); ng.gain.value = 0.035 * vel;
  ns.connect(nf); nf.connect(ng); ng.connect(out);
  ns.start(t0);
  return nodes;
}

/* 自鳴琴1音。息の立ち上がりがあり、鍵を離すまで鳴りつづける */
function pipe(ac, out, f, t0, dur, vel) {
  const len = Math.max(0.12, dur);
  const parts = [[1, 1.0], [2, 0.30], [3, 0.10], [4, 0.05]];
  for (const [n, amp] of parts) {
    const fn = f * n;
    if (fn > ac.sampleRate * 0.46) continue;
    const o = ac.createOscillator();
    o.type = n === 1 ? "sine" : "triangle";
    o.frequency.value = fn;
    o.detune.value = (n - 1) * 2.5;
    const g = ac.createGain();
    const a = amp * vel * 0.10;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(a, t0 + 0.028 + n * 0.004);
    g.gain.setValueAtTime(a, t0 + len);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + len + 0.10);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + len + 0.14);
  }
  /* 歌口の息。パイプらしさはここで決まる */
  const nb = ac.createBuffer(1, Math.ceil(ac.sampleRate * (len + 0.2)), ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const ns = ac.createBufferSource(); ns.buffer = nb;
  const nf = ac.createBiquadFilter();
  nf.type = "bandpass"; nf.frequency.value = f * 2; nf.Q.value = 2.4;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0, t0);
  ng.gain.linearRampToValueAtTime(0.020 * vel, t0 + 0.012);
  ng.gain.linearRampToValueAtTime(0.006 * vel, t0 + 0.10);
  ng.gain.setValueAtTime(0.006 * vel, t0 + len);
  ng.gain.linearRampToValueAtTime(0, t0 + len + 0.08);
  ns.connect(nf); nf.connect(ng); ng.connect(out);
  ns.start(t0); ns.stop(t0 + len + 0.2);
}

/* ─── 残響 ───────────────────────────────
   雑音を減衰させただけの畳み込みだと、高域が砂のように残って耳につく。
   ・初期反射を数発置く（壁までの距離が聞こえるようになる）
   ・時間が経つほど高域を落とす（空気と壁に吸われるぶん）
   ・左右で別の雑音を使い、初期反射の時刻もずらす（広がりが出る） */

export const ROOMS = {
  kammer: { ja: "小部屋", de: "Kammer", sec: 1.15, damp: 0.55, pre: 0.008 },
  saal:   { ja: "広間",   de: "Saal",   sec: 2.20, damp: 0.40, pre: 0.020 },
  kirche: { ja: "聖堂",   de: "Kirche", sec: 4.60, damp: 0.28, pre: 0.035 },
};

export function makeIR(ac, roomKey) {
  const r = ROOMS[roomKey] || ROOMS.saal;
  const len = Math.max(1, Math.floor(ac.sampleRate * r.sec));
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  /* 初期反射。左右でわずかにずらす */
  const early = [[0.011, 0.42], [0.019, 0.31], [0.029, 0.24], [0.041, 0.18], [0.057, 0.13]];
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    const skew = ch ? 1.07 : 0.94;
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      /* 高域の減衰。後ろへ行くほど一極フィルタを重くする */
      const a = 1 - Math.pow(r.damp, 1 + t * 3);
      lp += a * ((Math.random() * 2 - 1) - lp);
      const pre = i < ac.sampleRate * r.pre * skew ? 0 : 1;      /* 前隙間 */
      d[i] = lp * Math.pow(1 - t, 2.2) * pre;
    }
    for (const [sec, amp] of early) {
      const k = Math.floor(ac.sampleRate * sec * skew);
      if (k < len) d[k] += amp * (ch ? -1 : 1);
    }
  }
  return ir;
}

/* 賽が卓に落ちる音。木と木 */
export function diceClack(ac, out, t0, hard = 1) {
  const n = Math.ceil(ac.sampleRate * 0.09);
  const b = ac.createBuffer(1, n, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 14);
  const s = ac.createBufferSource(); s.buffer = b;
  const f = ac.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 1100 + Math.random() * 900; f.Q.value = 1.6;
  const g = ac.createGain(); g.gain.value = 0.16 * hard;
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t0);
}

/* 表に出る口 */
export function makeVoice(ac, out, kind) {
  return (midi, t0, dur, vel, temp, a4) => {
    const f = freqOf(midi, temp, a4);
    if (kind === "floetenuhr") pipe(ac, out, f, t0, dur, vel);
    else strike(ac, out, f, t0, dur, vel);
  };
}
