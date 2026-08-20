import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BARS, DIAL, CHORDS, SUMS, WAYS, roll2, pick, pathOf, skeleton, dialOf,
  TOTAL, AGREED, H_ROLL, P, codeOf, decodeCode, leaning,
} from "./progressions.js";
import { MOVEMENTS, plan, build } from "./figuration.js";
import { C, planPage, drawPage, drawDie } from "./engrave.js";
import { INSTRUMENTS, TEMPERAMENTS, PITCHES, ROOMS, makeIR, makeVoice, diceClack } from "./fortepiano.js";
import { loadSalamander, makeSampler } from "./salamander.js";
import { schedule, playOrder } from "./perform.js";
import { renderHalfSpeed, playBuffer, RATIO } from "./varispeed.js";
import { toSMF, download } from "./midi.js";
import { drawKeys, drawGlow } from "./keyboard.js";
import { drawFrame, pickFormat, REC_W, REC_H, SCORE_W, ERA_COLOR } from "./frame.js";
import { ESSAY, OPENING, remark } from "./thought.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

const F_SERIF = "'Cormorant Garamond', Georgia, 'Hiragino Mincho ProN', 'Yu Mincho', serif";
const F_MONO = "Cousine, 'Courier New', 'Hiragino Sans', monospace";
const F_JA = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";

const BG = "#0b0f14";
const LAB = { fontFamily: F_MONO, fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: C.mute };
const S = {
  wrap: { minHeight: "100vh", background: BG, color: C.text, padding: "44px 20px 80px", fontFamily: F_JA },
  inner: { maxWidth: 1180, margin: "0 auto" },
  card: { background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)", padding: 20 },
  rule: { height: 1, background: "linear-gradient(90deg,#7d94b8,#e2be6a,#c9705a,rgba(0,0,0,0))", margin: "18px 0 26px" },
  btn: (on, dim) => ({
    background: on ? C.gold : "transparent", color: on ? BG : C.text,
    border: `1px solid ${on ? C.gold : "rgba(255,255,255,0.22)"}`,
    padding: "8px 15px", cursor: dim ? "default" : "pointer", opacity: dim ? 0.32 : 1,
    fontFamily: F_MONO, fontSize: 11, letterSpacing: "0.1em", transition: "all .18s",
  }),
};

function Slider({ label, val, set, min, max, step, fmt }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={LAB}>{label}</span><span style={{ ...LAB, color: C.gold }}>{fmt ? fmt(val) : val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={(e) => set(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.gold }} />
    </div>
  );
}
function Choice({ label, options, val, set }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ ...LAB, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((o) => <button key={o.key} onClick={() => set(o.key)} style={S.btn(val === o.key)}>{o.ja}</button>)}
      </div>
    </div>
  );
}

export default function InfinityMyLife() {
  const [sums, setSums] = useState([]);
  const [dice, setDice] = useState([0, 0]);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState(OPENING);
  const [playing, setPlaying] = useState(false);
  const [playBar, setPlayBar] = useState(-1);
  const [mv, setMv] = useState(0);
  const [perpetual, setPerpetual] = useState(false);
  const [loopMv, setLoopMv] = useState(null);       /* この楽章だけを振り直しつづける */
  const [showing, setShowing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recNote, setRecNote] = useState("");
  const [salNote, setSalNote] = useState("");
  const [tapeNote, setTapeNote] = useState("");

  const [inst, setInst] = useState("salamander");
  const [temp, setTemp] = useState("equal");
  const [a4, setA4] = useState(440);
  const [barSec, setBarSec] = useState(0.92);
  const [repeat, setRepeat] = useState(true);
  const [human, setHuman] = useState(0.45);
  const [period, setPeriod] = useState(false);
  const [room, setRoom] = useState("saal");
  const [wet, setWet] = useState(0.30);
  const [tape, setTape] = useState(true);            /* 半速録音を使うか */

  const acRef = useRef(null), busRef = useRef(null), outRef = useRef(null);
  const convRef = useRef(null), wetRef = useRef(null), dryRef = useRef(null);
  const salRef = useRef(null), salLoading = useRef(false);
  const scoreRef = useRef(null), diceRef = useRef(null), keysRef = useRef(null), wrapRef = useRef(null);
  const recRef = useRef(null), recScoreRef = useRef(null);
  const [pageW, setPageW] = useState(1080);
  const rafRef = useRef(0), playRef = useRef(null), showBusy = useRef(false), mrRef = useRef(null);
  const sumsRef = useRef([]), cellsRef = useRef([]), mvRef = useRef(null), liveRef = useRef({});
  const cfg = useRef({});
  cfg.current = { inst, temp, a4, barSec, repeat, human, period, room, wet, tape };
  const perpRef = useRef(false); perpRef.current = perpetual;
  const loopRef = useRef(null); loopRef.current = loopMv;

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,500;0,600;1,300&family=Cousine&display=swap";
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch (e) {} };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPageW(Math.max(560, e.contentRect.width)));
    ro.observe(el); setPageW(Math.max(560, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  /* ─── 音の道 ─── */
  const audio = useCallback(() => {
    if (acRef.current) return acRef.current;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const conv = ac.createConvolver(); conv.buffer = makeIR(ac, cfg.current.room || "saal");
    const wetG = ac.createGain(); wetG.gain.value = cfg.current.wet ?? 0.3;
    const dryG = ac.createGain(); dryG.gain.value = 1;
    const bus = ac.createGain(); bus.gain.value = 0.9;
    const out = ac.createGain(); out.gain.value = 0.85;
    bus.connect(dryG); dryG.connect(out);
    bus.connect(conv); conv.connect(wetG); wetG.connect(out);
    out.connect(ac.destination);
    acRef.current = ac; busRef.current = bus; outRef.current = out;
    convRef.current = conv; wetRef.current = wetG; dryRef.current = dryG;
    return ac;
  }, []);
  useEffect(() => { const ac = acRef.current; if (ac && convRef.current) convRef.current.buffer = makeIR(ac, room); }, [room]);
  useEffect(() => {
    const ac = acRef.current; if (!ac || !wetRef.current) return;
    wetRef.current.gain.setTargetAtTime(wet, ac.currentTime, 0.05);
    dryRef.current.gain.setTargetAtTime(1 - wet * 0.35, ac.currentTime, 0.05);
  }, [wet]);

  const wantSalamander = useCallback(async () => {
    if (salRef.current || salLoading.current) return;
    salLoading.current = true;
    const ac = audio();
    const base = import.meta.env.BASE_URL || "/";
    try {
      setSalNote("標本を読み込み中… 0 / 30");
      const bank = await loadSalamander(ac, [`${base}salamander/`, "https://tonejs.github.io/audio/salamander/"],
        (n, all) => setSalNote(n >= all ? "" : `標本を読み込み中… ${n} / ${all}`),
        (partial) => { salRef.current = partial; setSalNote("中核10音が揃った"); });
      salRef.current = bank; setSalNote("");
    } catch (e) { setSalNote("標本が読めなかった。合成の音で鳴らす"); }
    finally { salLoading.current = false; }
  }, [audio]);
  useEffect(() => { if (inst === "salamander") wantSalamander(); }, [inst, wantSalamander]);

  /* ─── 賽 ─── */
  const done = sums.length >= BARS;
  const rollOne = useCallback(() => {
    const prev = sumsRef.current;
    if (prev.length >= BARS) return;
    const r = roll2();
    const bar = prev.length;
    const p = pick(bar, r.sum);
    const next = [...prev, r.sum];
    sumsRef.current = next;
    setSums(next); setDice([r.a, r.b]);
    setLine(remark(bar + 1, r.sum, CHORDS[p.key].name, p.era));
    const ac = audio();
    if (ac.state === "suspended") ac.resume();
    diceClack(ac, busRef.current, ac.currentTime, 1);
    diceClack(ac, busRef.current, ac.currentTime + 0.055, 0.7);
  }, [audio]);

  const TUMBLE = 400;
  const tumbleOnce = useCallback(() => new Promise((resolve) => {
    const t0 = performance.now(); let raf = 0;
    const spin = () => {
      setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      if (performance.now() - t0 < TUMBLE - 30) raf = requestAnimationFrame(spin);
    };
    spin();
    setTimeout(() => { cancelAnimationFrame(raf); try { rollOne(); } catch (e) { console.error(e); } resolve(); }, TUMBLE);
  }), [rollOne]);

  const rollMany = useCallback(async (n, gap) => {
    if (busy) return;
    setBusy(true);
    /* resume() は操作を伴わないと解決しないことがあるので待たない。
       ここで待つと、賽が一度も転がらないまま止まってしまう */
    const ac = audio(); if (ac.state === "suspended") ac.resume();
    for (let i = 0; i < n; i++) { await tumbleOnce(); if (i < n - 1) await sleep(gap); }
    setBusy(false);
  }, [busy, tumbleOnce, audio]);

  const clearAll = useCallback(() => {
    sumsRef.current = [];
    setSums([]); setDice([0, 0]); setLine(OPENING);
    history.replaceState(null, "", location.pathname + location.search);
  }, []);

  useEffect(() => {
    const code = decodeCode((location.hash || "").replace(/^#/, ""));
    if (code) { sumsRef.current = code; setSums(code); setLine(`番地 ${codeOf(code)} を呼び出した。`); }
  }, []);
  useEffect(() => { if (sums.length === BARS) history.replaceState(null, "", "#" + codeOf(sums)); }, [sums]);

  /* ─── 譜面 ─── */
  const skel = useMemo(() => (sums.length < BARS ? null : skeleton(pathOf(sums))), [sums]);
  const movement = useMemo(() => (skel ? build(mv, skel, sums) : null), [mv, skel, sums]);
  const movePlan = useMemo(() => (sums.length ? plan(sums) : null), [sums]);
  const cells = movement ? movement.cells : [];
  cellsRef.current = cells; mvRef.current = movement;

  const pageOpts = useMemo(() => ({
    rows: movement ? movement.rows : [8, 9],
    keyN: movement ? movement.keyN : 3,
    sharps: true,
    meter: movement ? movement.meter : [3, 8],
  }), [movement]);
  const geom = useMemo(() => planPage(cells, pageW, pageOpts), [cells, pageW, pageOpts]);
  const recGeom = useMemo(() => planPage(cells, SCORE_W, pageOpts), [cells, pageOpts]);

  const liveKeys = useCallback(() => {
    const st = playRef.current, keys = new Map();
    if (!st || !acRef.current) return keys;
    const now = (acRef.current.currentTime - st.t0) * (st.rate || 1);
    for (const n of st.sch.notes) {
      if (n.t > now) break;
      const span = n.dur + 0.34;
      if (now >= n.t + span) continue;
      const age = (now - n.t) / span;
      const p = keys.get(n.midi);
      if (!p || age < p.age) keys.set(n.midi, { age, vel: n.vel, hand: n.staff ? "R" : "L" });
    }
    return keys;
  }, []);

  const paintScore = useCallback((ctx, g, dpr) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const sys of g.systems) for (const cell of sys.cells) { cell.fade = 1; cell.dice = null; }
    drawPage(ctx, g, {
      revealed: 99, active: playRef.current?.activeSet || null,
      activeCell: liveRef.current.playBar ?? -1, showDice: false, showNums: false,
      title: movement ? movement.ja : null,
      subtitle: movement ? `${movement.note} — ${movement.era}${movement.varispeed ? "・半速録音" : ""}` : null,
    });
  }, [movement]);

  const paint = useCallback(() => {
    const cv = scoreRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { W, H } = geom;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + "px"; cv.style.height = H + "px";
    }
    if (cells.length) paintScore(cv.getContext("2d"), geom, dpr);
    const kc = keysRef.current;
    if (kc) {
      const w = kc.clientWidth, h = 96;
      if (kc.width !== Math.round(w * dpr)) { kc.width = Math.round(w * dpr); kc.height = Math.round(h * dpr); kc.style.height = h + "px"; }
      const kx = kc.getContext("2d");
      kx.setTransform(dpr, 0, 0, dpr, 0, 0); kx.clearRect(0, 0, w, h);
      const keys = liveKeys();
      drawGlow(kx, 0, 6, w, 6, keys);
      drawKeys(kx, 0, 6, w, h - 6, keys, { period });
    }
  }, [geom, cells, paintScore, liveKeys, period]);
  const paintRef = useRef(paint); paintRef.current = paint;
  useEffect(() => {
    let stop = false;
    const loop = () => { if (stop) return; paintRef.current(); rafRef.current = requestAnimationFrame(loop); };
    loop();
    return () => { stop = true; cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const cv = diceRef.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = 120;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const s = 78, gap = 20, x0 = (W - s * 2 - gap) / 2;
    for (let i = 0; i < 2; i++) {
      const v = dice[i] || 0;
      ctx.save(); ctx.translate(x0 + i * (s + gap), (H - s) / 2);
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
      drawDie(ctx, 0, 0, s, v || 1, v ? "#1b232c" : "rgba(120,130,150,0.35)", v ? "#e9e3d4" : "rgba(255,255,255,0.05)");
      ctx.restore();
    }
  }, [dice]);

  /* ─── 演奏 ─── */
  const voiceFor = useCallback((ctx, dest) => {
    const c = cfg.current;
    return c.inst === "salamander" && salRef.current
      ? makeSampler(ctx, dest, salRef.current)
      : makeVoice(ctx, dest, c.inst === "salamander" ? "fortepiano" : c.inst);
  }, []);

  const stop = useCallback(() => {
    const st = playRef.current;
    if (st) { clearInterval(st.timer); try { st.src && st.src.stop(); } catch (e) {} playRef.current = null; }
    setPlaying(false); setPlayBar(-1);
    if (acRef.current && busRef.current) {
      const ac = acRef.current;
      busRef.current.gain.setTargetAtTime(0, ac.currentTime, 0.06);
      setTimeout(() => busRef.current && busRef.current.gain.setTargetAtTime(0.9, ac.currentTime, 0.05), 260);
    }
  }, []);

  const startPlay = useCallback(async () => {
    if (sumsRef.current.length < BARS) return null;
    if (playRef.current) { clearInterval(playRef.current.timer); playRef.current = null; }
    const ac = audio();
    if (ac.state === "suspended") ac.resume();
    const c = cfg.current;
    const V = mvRef.current;
    const order = playOrder(cellsRef.current, c.repeat);
    const sch = schedule(order, { barSec: c.barSec, tempoScale: V ? V.tempo : 1, human: c.human, ornaments: true, lilt: 0.06 });
    const useTape = c.tape && V && V.varispeed;
    setPlaying(true);

    const st = { sch, t0: 0, activeSet: new Set(), timer: 0, rate: 1 };
    playRef.current = st;

    if (useTape) {
      /* 半速で書き出してから、倍速で戻す */
      setTapeNote("テープを半分の速さで回している…");
      let buf;
      try {
        buf = await renderHalfSpeed(ac.sampleRate, sch, voiceFor, { temp: c.temp, a4: c.a4 });
      } catch (e) { setTapeNote("書き出せなかったので等速で鳴らす"); }
      if (playRef.current !== st) return null;
      setTapeNote("");
      if (buf) {
        st.rate = 1; st.t0 = ac.currentTime + 0.15;
        st.src = playBuffer(ac, busRef.current, buf, st.t0, RATIO);
      }
    }
    if (!st.src) {
      const voice = voiceFor(ac, busRef.current);
      st.t0 = ac.currentTime + 0.3;
      let i = 0;
      st.pump = () => {
        const now = ac.currentTime;
        while (i < sch.notes.length && sch.notes[i].t + st.t0 < now + 0.35) {
          const n = sch.notes[i++];
          voice(n.midi, st.t0 + n.t, n.dur, n.vel, c.temp, c.a4);
        }
      };
    }

    const tick = () => {
      if (st.pump) st.pump();
      const at = acRef.current.currentTime - st.t0;
      const cur = sch.bars.filter((b) => b.t <= at).pop();
      setPlayBar(cur ? cur.pos : -1);
      st.activeSet = new Set();
      const w = cur?.cell?.written;
      if (w) for (const s of w.staves) for (const v of s) for (const e of v.ev) {
        const et = cur.t + (e.t / cur.ticks) * cur.sec;
        if (at >= et - 0.02 && at < et + (e.dur / cur.ticks) * cur.sec) st.activeSet.add(e);
      }
      if (at > sch.length + 1.8) {
        clearInterval(st.timer); playRef.current = null;
        setPlaying(false); setPlayBar(-1);
      }
    };
    st.timer = setInterval(tick, 40);
    tick();
    return st;
  }, [audio, voiceFor]);

  const playAndWait = useCallback(async () => {
    const st = await startPlay();
    if (!st) return;
    while (playRef.current === st) await sleep(120);
  }, [startPlay]);

  const runSet = useCallback(async (alive = () => true) => {
    for (let i = 0; i < MOVEMENTS.length; i++) {
      if (!alive()) return;
      setMv(i);
      await sleep(750);
      if (!alive()) return;
      await playAndWait();
      await sleep(550);
    }
  }, [playAndWait]);

  const playSet = useCallback(async () => {
    if (showBusy.current || sumsRef.current.length < BARS) return;
    showBusy.current = true; setBusy(true);
    try { await runSet(() => showBusy.current); }
    finally { showBusy.current = false; setBusy(false); }
  }, [runSet]);

  /* ひとつの楽章だけを、賽を振り直しながら延々と作りつづける。
     第4変奏（動機・モルデント・走り下り・左右交互）でいちばん効く */
  useEffect(() => {
    if (loopMv == null || showBusy.current) return;
    let alive = true;
    (async () => {
      while (alive && loopRef.current != null) {
        clearAll();
        setMv(loopRef.current);
        await sleep(260);
        for (let i = 0; i < BARS && alive && loopRef.current != null; i++) { await tumbleOnce(); await sleep(110); }
        if (!alive || loopRef.current == null) return;
        await sleep(620);
        await playAndWait();
        await sleep(700);
      }
    })();
    return () => { alive = false; };
  }, [loopMv, clearAll, tumbleOnce, playAndWait]);

  useEffect(() => {
    if (!perpetual || showBusy.current) return;
    let alive = true;
    (async () => {
      while (alive && perpRef.current) {
        setMv(0); clearAll(); await sleep(300);
        for (let i = 0; i < BARS && alive && perpRef.current; i++) { await tumbleOnce(); await sleep(160); }
        if (!alive || !perpRef.current) return;
        await sleep(700);
        await runSet(() => alive && perpRef.current);
        await sleep(1100);
      }
    })();
    return () => { alive = false; };
  }, [perpetual, clearAll, tumbleOnce, runSet]);

  /* ─── 録画 ─── */
  liveRef.current = { line, playBar, sums, dice };
  const paintRecFrame = useCallback(() => {
    const cv = recRef.current, sc = recScoreRef.current;
    if (!cv || !sc) return;
    if (sc.width !== Math.round(recGeom.W) || sc.height !== Math.round(recGeom.H)) {
      sc.width = Math.round(recGeom.W); sc.height = Math.round(recGeom.H);
    }
    if (cells.length) paintScore(sc.getContext("2d"), recGeom, 1);
    const l = sums.length;
    drawFrame(cv.getContext("2d"), {
      sums, cursor: l < BARS ? l : -1, dice,
      score: cells.length ? sc : null, scoreH: recGeom.H,
      keys: liveKeys(), period,
      code: l === BARS ? codeOf(sums) : "",
      remaining: l ? `1787 ←${"─".repeat(3)}◆${"─".repeat(3)}→ 1965   ${pct(leaning(sums))}` : "",
      movement: movement ? `${movement.ja} — ${movement.note}・${movement.era}${movement.varispeed ? "・半速録音" : ""}` : "",
      caption: liveRef.current.line,
    });
  }, [recGeom, sums, dice, cells, paintScore, liveKeys, period, movement]);
  const recPaintRef = useRef(paintRecFrame); recPaintRef.current = paintRecFrame;
  useEffect(() => {
    if (!showing) return;
    const draw = () => recPaintRef.current();
    draw();
    const id = setInterval(draw, 33);
    return () => clearInterval(id);
  }, [showing]);

  /* 録画は上演から切り離す。振り続けの輪を回したまま録りはじめられるように */
  const beginRecording = useCallback(() => {
    const ac = audio();
    if (ac.state === "suspended") ac.resume();
    const fmt = pickFormat();
    if (!fmt) { setRecNote("この環境では録画できない"); return null; }
    const stream = recRef.current.captureStream(30);
    const dest = ac.createMediaStreamDestination();
    outRef.current.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const chunks = [];
    const mr = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 6_000_000 });
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      outRef.current.disconnect(dest);
      download(new Blob(chunks, { type: fmt.mime }),
        `infinity-my-life-${codeOf(liveRef.current.sums) || "show"}.${fmt.ext}`, fmt.mime);
      setRecNote(`${fmt.ext.toUpperCase()} で保存した`);
    };
    mr.start(1000);
    mrRef.current = mr;
    setRecording(true);
    setRecNote(`録画中（${fmt.ext}）`);
    return mr;
  }, [audio]);

  const endRecording = useCallback(() => {
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    mrRef.current = null;
    setRecording(false);
  }, []);

  /* 録画の入り口。輪が回っていればそれを録り、そうでなければ通しの上演を録る */
  const onRecord = useCallback(async () => {
    if (mrRef.current) { endRecording(); if (loopRef.current == null) setShowing(false); return; }
    if (loopRef.current != null) {
      setShowing(true);
      await sleep(150);                       /* こまのキャンバスが出るのを待つ */
      beginRecording();
      return;
    }
    runShowRef.current(true);
  }, [beginRecording, endRecording]);

  const runShow = useCallback(async (record) => {
    if (showBusy.current) return;
    showBusy.current = true; setShowing(true); setBusy(true);
    let mr = null;
    try {
      stop(); clearAll(); await sleep(120);
      const ac = audio();
      if (ac.state === "suspended") ac.resume();
      if (record) { await sleep(150); mr = beginRecording(); }
      setMv(0);
      await sleep(1400);
      for (let i = 0; i < BARS; i++) { await tumbleOnce(); await sleep(220); }
      await sleep(1100);
      await runSet(() => showBusy.current);
      await sleep(1600);
    } finally {
      if (mr) endRecording();
      setBusy(false); showBusy.current = false;
      if (!record) setShowing(false);
    }
  }, [audio, stop, clearAll, tumbleOnce, runSet, beginRecording, endRecording]);
  const runShowRef = useRef(runShow); runShowRef.current = runShow;

  useEffect(() => () => { if (playRef.current) clearInterval(playRef.current.timer); }, []);

  const saveMidi = () => {
    if (!done) return;
    const c = cfg.current;
    const sch = schedule(playOrder(cells, c.repeat), { barSec: c.barSec, tempoScale: movement ? movement.tempo : 1, human: 0, lilt: 0, ritard: false });
    download(toSMF(sch.notes, { bpm: 60 / (c.barSec / 1.5), title: `${movement ? movement.ja : ""} ${codeOf(sums)}` }),
      `infinity-my-life-${codeOf(sums)}-${movement ? movement.key : "x"}.mid`, "audio/midi");
  };
  const savePng = () => {
    const cv = scoreRef.current; if (!cv) return;
    paintRef.current();
    cv.toBlob((b) => download(b, `infinity-my-life-${done ? codeOf(sums) : "x"}-${movement ? movement.key : "x"}.png`, "image/png"));
  };

  const mixP = P[3] + P[4] + P[5] + P[6] + P[7];
  const endP = (1 - mixP) / 2;
  const fill = (s) => s
    .replace(/\{TOTAL\}/g, TOTAL.toLocaleString())
    .replace(/\{AGREED\}/g, String(AGREED))
    .replace(/\{MIXPCT\}/g, pct(mixP))
    .replace(/\{ENDPCT\}/g, pct(endP))
    .replace(/\s+/g, "");
  const lean = done ? leaning(sums) : 0.5;
  const canRoll = !busy && !done;

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <header>
          <div style={{ ...LAB, color: C.gold, marginBottom: 8 }}>
            1787 Würfelspiel × 1965 Varispeed
          </div>
          <h1 style={{ fontFamily: F_SERIF, fontWeight: 300, fontSize: 56, letterSpacing: "0.04em", margin: 0, lineHeight: 1 }}>
            INFINITY MY LIFE
          </h1>
          <div style={{ fontSize: 16, color: C.mute, marginTop: 10, letterSpacing: "0.06em" }}>
            半速のバロック — モーツァルトの変奏技法と、テープを半分の速さで回す手つきを、賽が混ぜる。
          </div>
        </header>
        <div style={S.rule} />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(380px,1.8fr)", gap: 18, alignItems: "start" }}>
          <div style={S.card}>
            <div style={{ ...LAB, marginBottom: 10 }}>卓 — Wurf</div>
            <canvas ref={diceRef} style={{ width: "100%", display: "block" }} />
            <div style={{ textAlign: "center", fontFamily: F_MONO, fontSize: 12, color: C.gold, letterSpacing: "0.2em", minHeight: 18 }}>
              {dice[0] ? `${dice[0]} + ${dice[1]} = ${dice[0] + dice[1]}` : "—"}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 38, marginTop: 12 }}>
              {SUMS.map((s, i) => {
                const cur = dice[0] && dice[0] + dice[1] === s;
                const era = s <= 4 ? "1787" : s >= 10 ? "1965" : "mix";
                return (
                  <div key={s} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ height: WAYS[i] * 5, background: cur ? ERA_COLOR[era] : "rgba(255,255,255,0.13)" }} />
                    <div style={{ fontFamily: F_MONO, fontSize: 8.5, color: cur ? ERA_COLOR[era] : C.mute, marginTop: 3 }}>{s}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ ...LAB, textTransform: "none", letterSpacing: "0.04em", marginTop: 8, fontSize: 10.5, lineHeight: 1.7 }}>
              和が小さいほど1787年、大きいほど1965年へ。7がいちばん出やすいので、まん中に寄る
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 16 }}>
              <button onClick={() => rollMany(1, 0)} disabled={!canRoll} style={{ ...S.btn(false, !canRoll), flex: "1 1 auto" }}>賽を振る</button>
              <button onClick={() => rollMany(BARS - sums.length, 210)} disabled={!canRoll} style={S.btn(false, !canRoll)}>十六回</button>
              <button onClick={clearAll} disabled={busy} style={S.btn(false, busy)}>新しい紙</button>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...LAB }}>
                <span>1787 ← ダイヤル → 1965</span><span style={{ color: C.gold }}>{sums.length} / 16</span>
              </div>
              <div style={{ position: "relative", height: 6, marginTop: 8,
                background: "linear-gradient(90deg,#7d94b8,#e2be6a,#c9705a)", opacity: done ? 1 : 0.35 }}>
                {done && <div style={{ position: "absolute", left: `calc(${lean * 100}% - 5px)`, top: -4,
                  width: 10, height: 14, background: C.paper, border: `1px solid ${BG}` }} />}
              </div>
              <div style={{ ...LAB, marginTop: 8, textTransform: "none", letterSpacing: "0.04em", fontSize: 10.5 }}>
                {done ? `この曲の位置 ${pct(lean)}（0% = 1787年、100% = 1965年）` : "十六回振ると位置が決まる"}
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.75, opacity: 0.86, minHeight: 58 }}>{line}</div>
          </div>

          {/* ダイヤル表 */}
          <div style={S.card}>
            <div style={{ ...LAB, marginBottom: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span>ダイヤル — 1787 / 1965</span>
              <span style={{ color: C.gold }}>上が1787年の骨、下が1965年の進行</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${BARS}, minmax(38px,1fr))`, gap: 3, minWidth: 620 }}>
                {DIAL.map((list, i) => {
                  const s = sums[i];
                  const p = s == null ? null : pick(i, s);
                  const next = i === sums.length && !done;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontFamily: F_MONO, fontSize: 9, textAlign: "center",
                        color: next ? C.goldLit : C.mute }}>{i + 1}</div>
                      {[0, 1, 2].map((j) => {
                        const has = j < list.length;
                        const single = list.length === 1;
                        const key = single ? (j === 1 ? list[0] : null) : list[j];
                        if (!key) return <div key={j} style={{ height: 20 }} />;
                        const era = single ? "both" : j === 0 ? "1787" : j === list.length - 1 ? "1965" : "mix";
                        const on = p && p.key === key && (single || DIAL[i][j] === p.key);
                        return (
                          <div key={j} style={{
                            height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: F_MONO, fontSize: 10, letterSpacing: "0.02em",
                            background: on ? ERA_COLOR[era] : next ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)",
                            color: on ? BG : "rgba(226,220,239,0.4)", fontWeight: on ? 700 : 400,
                            transition: "background .25s",
                          }}>{CHORDS[key].name}</div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ ...LAB, textTransform: "none", letterSpacing: "0.04em", marginTop: 12, lineHeight: 1.8, fontSize: 10.5 }}>
              上段 = K.516f の骨をイ長調に移したもの（A A E A B7 E B7 E7 …）。
              下段 = 1965年10月のバロック模倣が乗っている進行（A E F♯m A7 D Dm A …）。
              中段は、どちらから見ても筋の通る和音。{AGREED}か所は両者がもともと一致している
            </div>
          </div>
        </div>

        {showing && (
          <div style={{ ...S.card, marginTop: 18, padding: 14 }}>
            <div style={{ ...LAB, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
              <span>上演 — 1280×720</span>
              <span style={{ color: recording ? "#c9705a" : C.gold }}>{recording ? "● 録画中" : recNote || "下見"}</span>
            </div>
            <canvas ref={recRef} width={REC_W} height={REC_H} style={{ width: "100%", display: "block", background: BG }} />
          </div>
        )}
        <canvas ref={recScoreRef} style={{ position: "fixed", left: -99999, top: 0 }} />

        {/* 譜面 */}
        <div style={{ ...S.card, marginTop: 18, padding: 14 }} ref={wrapRef}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            {MOVEMENTS.map((m, i) => {
              const p = movePlan ? movePlan[i] : null;
              return (
                <button key={m.key} onClick={() => setMv(i)} disabled={!done || (busy && !playing)} title={m.note}
                  style={{ ...S.btn(mv === i, !done), padding: "6px 10px", fontSize: 10, letterSpacing: "0.06em",
                    borderColor: mv === i ? C.gold : p ? ERA_COLOR[p.era] : "rgba(255,255,255,0.22)" }}>
                  {m.ja}{p && p.varispeed ? " ½" : ""}
                </button>
              );
            })}
            <span style={{ ...LAB, marginLeft: 6, textTransform: "none", letterSpacing: "0.04em", color: C.gold }}>
              {movement ? `${movement.note} — ${movement.era}年の語彙・${movement.meter.join("/")}${movement.varispeed ? "・半速録音" : ""}`
                : "十六回振ると譜面が組める"}
            </span>
          </div>
          <canvas ref={scoreRef} style={{ width: "100%", display: "block", background: C.paper }} />
          <canvas ref={keysRef} style={{ width: "100%", display: "block", marginTop: 10 }} />
          {tapeNote && <div style={{ ...LAB, textTransform: "none", marginTop: 8, color: "#c9705a", fontSize: 11 }}>{tapeNote}</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button onClick={playing ? stop : startPlay} disabled={!done || busy}
              style={{ ...S.btn(playing, !done || busy), padding: "10px 22px", fontSize: 12 }}>
              {playing ? "止める" : "弾かせる"}
            </button>
            <button onClick={playSet} disabled={!done || busy} style={{ ...S.btn(false, !done || busy), padding: "10px 18px", fontSize: 12 }}>
              主題から終曲まで通す
            </button>
            <button onClick={() => runShow(false)} disabled={busy} style={S.btn(showing && !recording, busy)}>上演</button>
            <button onClick={onRecord} disabled={busy && !recording && loopMv == null}
              style={S.btn(recording, busy && !recording && loopMv == null)}>
              {recording ? "■ 録画を止める" : "● 録画"}
            </button>
            <button onClick={() => { setLoopMv(null); setPerpetual((v) => !v); }}
              disabled={(busy && !perpetual) || loopMv != null}
              style={S.btn(perpetual, (busy && !perpetual) || loopMv != null)}>永久機関</button>
            <button onClick={() => { setPerpetual(false); setLoopMv((v) => (v == null ? 4 : null)); }}
              disabled={busy && loopMv == null}
              style={S.btn(loopMv != null, busy && loopMv == null)}>
              第4変奏を振り続ける
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setTape((v) => !v)} style={S.btn(tape)}>半速録音</button>
            <button onClick={() => setRepeat((v) => !v)} style={S.btn(repeat)}>反復</button>
            <button onClick={() => setPeriod((v) => !v)} style={S.btn(period)}>当時の鍵盤</button>
            <button onClick={saveMidi} disabled={!done} style={S.btn(false, !done)}>MIDI</button>
            <button onClick={savePng} style={S.btn(false)}>譜面を刷る</button>
          </div>
          <div style={{ ...LAB, textTransform: "none", letterSpacing: "0.04em", marginTop: 10, fontSize: 10.5, lineHeight: 1.8 }}>
            「半速録音」を入れると、1965年へ寄った変奏は、いったん半分の速さ・1オクターヴ下で書き出してから、
            倍速で戻して鳴らす。1965年10月22日にEMIスタジオでやられたのと同じ演算——
            減衰が半分になり、間合いが平らになる
          </div>
        </div>

        {/* 調整と番地 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
          <div style={S.card}>
            <div style={{ ...LAB, marginBottom: 14 }}>調整</div>
            <Choice label="楽器" val={inst} set={setInst}
              options={Object.entries(INSTRUMENTS).map(([k, v]) => ({ key: k, ja: v.ja }))} />
            <div style={{ ...LAB, textTransform: "none", letterSpacing: "0.04em", marginTop: -6, marginBottom: 14, fontSize: 10.5, lineHeight: 1.7 }}>
              {INSTRUMENTS[inst].note}
              {inst === "salamander" && salNote && <><br /><span style={{ color: C.gold }}>{salNote}</span></>}
            </div>
            <Choice label="音律" val={temp} set={setTemp}
              options={Object.entries(TEMPERAMENTS).map(([k, v]) => ({ key: k, ja: v.ja }))} />
            <Choice label="基準音高" val={a4} set={setA4} options={PITCHES.map((p) => ({ key: p.hz, ja: p.ja }))} />
            <Slider label="速さ（1小節の秒）" val={barSec} set={setBarSec} min={0.55} max={1.6} step={0.01} fmt={(v) => `${v.toFixed(2)}s`} />
            <Slider label="人の手つき" val={human} set={setHuman} min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} />
            <Choice label="残響の広さ" val={room} set={setRoom} options={Object.entries(ROOMS).map(([k, v]) => ({ key: k, ja: v.ja }))} />
            <Slider label="残響の量" val={wet} set={setWet} min={0} max={0.85} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} />
          </div>

          <div style={S.card}>
            <div style={{ ...LAB, marginBottom: 14 }}>番地</div>
            {done ? (
              <>
                <div style={{ fontFamily: F_MONO, fontSize: 20, color: C.goldLit, letterSpacing: "0.16em", wordBreak: "break-all" }}>{codeOf(sums)}</div>
                <div style={{ fontFamily: F_MONO, fontSize: 11, color: C.mute, marginTop: 8, lineHeight: 1.8 }}>
                  出目 {sums.join("·")}<br />
                  和声 {pathOf(sums).map((p) => CHORDS[p.key].name).join(" ")}
                </div>
                <button onClick={() => navigator.clipboard?.writeText(location.href)} style={{ ...S.btn(false), marginTop: 14 }}>この番地を写す</button>
              </>
            ) : (
              <div style={{ fontSize: 13.5, lineHeight: 1.9, opacity: 0.7 }}>
                十六回振り終えると番地がつく。16個の出目が、和声の道順も、どの変奏をどちらの語彙で書くかも、
                どこでテープを回すかも決める。
              </div>
            )}
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "18px 0" }} />
            <div style={{ ...LAB, marginBottom: 10 }}>数</div>
            <table style={{ fontFamily: F_MONO, fontSize: 11, opacity: 0.82, borderCollapse: "collapse", lineHeight: 1.9 }}>
              <tbody>
                <tr><td style={{ color: C.mute, paddingRight: 14 }}>和声の道順</td><td>{TOTAL.toLocaleString()} 通り</td></tr>
                <tr><td style={{ color: C.mute, paddingRight: 14 }}>もともと一致</td><td>16小節中 {AGREED} か所</td></tr>
                <tr><td style={{ color: C.mute, paddingRight: 14 }}>混成が出る確率</td><td>{pct(mixP)}（両端は各 {pct(endP)}）</td></tr>
                <tr><td style={{ color: C.mute, paddingRight: 14 }}>1回の情報量</td><td>{H_ROLL.toFixed(4)} bit</td></tr>
                <tr><td style={{ color: C.mute, paddingRight: 14 }}>変速比</td><td>×{RATIO}（1オクターヴ）</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 思想 */}
        <div style={{ ...S.card, marginTop: 18, padding: "26px 26px 8px" }}>
          <div style={{ ...LAB, marginBottom: 20 }}>思想</div>
          <div style={{ columns: pageW > 860 ? 2 : 1, columnGap: 44 }}>
            {ESSAY.map((e) => (
              <section key={e.n} style={{ breakInside: "avoid", marginBottom: 26 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span style={{ fontFamily: F_SERIF, fontSize: 22, color: C.gold, lineHeight: 1 }}>{e.n}</span>
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 500, letterSpacing: "0.04em", color: C.paper }}>{e.t}</h3>
                </div>
                <p style={{ margin: "9px 0 0", fontSize: 14, lineHeight: 2.0, opacity: 0.82, textAlign: "justify" }}>{fill(e.b)}</p>
              </section>
            ))}
          </div>
        </div>

        <div style={{ ...LAB, marginTop: 24, lineHeight: 2.1, textTransform: "none", letterSpacing: "0.05em", fontSize: 10.5 }}>
          1787年の側 — W. A. モーツァルト作とされる《音楽のさいころ遊び》K.516f（帰属は疑わしい）。パブリックドメイン。
          その和声の骨は{" "}
          <a href="https://github.com/matsuo-koya/dice-the-mozart" target="_blank" rel="noreferrer" style={{ color: C.gold }}>dice-the-mozart</a>
          {" "}で176小節を実測して得たもの。<br />
          1965年の側 — 和音進行と、テープを半分の速さで回すという手つき。
          ジョージ・マーティンが1965年10月22日にEMIスタジオでおこなった方法にならう。
          <strong style={{ color: C.paper }}>旋律も、実際のソロも、ここには一音も入っていない。</strong>
          和音進行そのものに著作権はなく、鳴っている音はすべてこの機械が新しく作ったもの。<br />
          ピアノ標本 —{" "}
          <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noreferrer" style={{ color: C.gold }}>Salamander Grand Piano V3</a>
          、録音・制作 Alexander Holm 氏、
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" style={{ color: C.gold }}> CC BY 3.0</a>。
          <a href="https://tonejs.github.io/" target="_blank" rel="noreferrer" style={{ color: C.gold }}> Tone.js</a> 配布の変換版。<br />
          譜面も賽も鍵盤も Canvas 2D の手描き。音は Web Audio API を直に叩いている。
        </div>
      </div>
    </div>
  );
}
