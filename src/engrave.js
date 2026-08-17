/* ══════════════════════════════════════════════════════════════
   彫版 — 譜面を Canvas 2D に組む

   書体には頼らない。音部記号も変化記号も休符も装飾記号も、
   ぜんぶ「間（かん）＝線と線の間隔」を単位にして手で描く。
   代替書体は環境ごとに寸法も比率も違い、五線の上では必ず破綻するため。

   組み方は原典の刷りに合わせて2段。
     1段目 … 第1–7小節 と 第8小節の1番括弧（8枡）
     2段目 … 第8小節の2番括弧 と 第9–16小節（9枡）
   ══════════════════════════════════════════════════════════════ */

import { M38 as BAR_TICKS } from "./figuration.js";

export const C = {
  ink: "#0e0c18", ink2: "#171426",
  paper: "#e9dfc6", paper2: "#dbcdad", paperShade: "#cbb98f",
  sepia: "#33261a", sepiaSoft: "rgba(51,38,26,0.55)",
  gold: "#b08a3c", goldLit: "#e2be6a", red: "#9a2a2c",
  mute: "#8a839c", text: "#e2dcef", line: "rgba(255,255,255,0.08)",
};

const F_MONO = "Cousine, 'Courier New', monospace";
const F_SERIF = "'Cormorant Garamond', Georgia, 'Hiragino Mincho ProN', serif";

/* 五線の中でのその音の段数。C4 を 28 とし、1段 = 間の半分 */
const TREBLE_TOP = 38;    /* 高音部譜表のいちばん上の線 = F5 */
const BASS_TOP = 26;      /* 低音部譜表のいちばん上の線 = A3 */
const topStep = (staff) => (staff ? TREBLE_TOP : BASS_TOP);

/* ─── 部品 ─────────────────────────────── */

/* 符頭。少し右上がりの楕円 */
function head(ctx, x, y, SP, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, SP * 0.68, SP * 0.50, 0, 0, Math.PI * 2);
  if (filled) ctx.fill();
  else { ctx.lineWidth = SP * 0.20; ctx.stroke(); }
  ctx.restore();
}

/* 変化記号。♯は縦長、♮はもっと縦長、♭は洋梨。送り幅は次の記号までの距離 */
const ACC_W = { 1: 1.05, "-1": 0.88, 0: 0.85, 2: 0.95, "-2": 1.62 };

function drawAcc(ctx, alt, x, y, SP) {
  ctx.save();
  ctx.translate(x, y);
  const bar = (yy, halfW, th, slant) => {
    ctx.beginPath();
    ctx.moveTo(-halfW, yy - th / 2 + slant);
    ctx.lineTo(halfW, yy - th / 2 - slant);
    ctx.lineTo(halfW, yy + th / 2 - slant);
    ctx.lineTo(-halfW, yy + th / 2 + slant);
    ctx.closePath(); ctx.fill();
  };
  const flat = (dx) => {
    const sx = dx - SP * 0.24;
    ctx.fillRect(sx - SP * 0.05, -SP * 1.72, SP * 0.10, SP * 2.34);
    ctx.beginPath();
    ctx.moveTo(dx - SP * 0.19, -SP * 0.50);
    ctx.bezierCurveTo(dx + SP * 0.66, -SP * 0.60, dx + SP * 0.54, SP * 0.24, dx - SP * 0.19, SP * 0.62);
    ctx.bezierCurveTo(dx + SP * 0.30, SP * 0.16, dx + SP * 0.28, -SP * 0.22, dx - SP * 0.19, -SP * 0.30);
    ctx.closePath(); ctx.fill();
  };
  if (alt === 1) {
    const sw = SP * 0.10, hh = SP * 1.12;
    ctx.fillRect(-SP * 0.20 - sw / 2, -hh + SP * 0.10, sw, hh * 2);
    ctx.fillRect(SP * 0.20 - sw / 2, -hh - SP * 0.10, sw, hh * 2);
    bar(-SP * 0.40, SP * 0.46, SP * 0.25, SP * 0.10);
    bar(SP * 0.44, SP * 0.46, SP * 0.25, SP * 0.10);
  } else if (alt === 0) {
    const sw = SP * 0.095;
    ctx.fillRect(-SP * 0.20 - sw / 2, -SP * 1.20, sw, SP * 1.72);
    ctx.fillRect(SP * 0.20 - sw / 2, -SP * 0.52, sw, SP * 1.72);
    bar(-SP * 0.32, SP * 0.245, SP * 0.23, SP * 0.075);
    bar(SP * 0.32, SP * 0.245, SP * 0.23, SP * 0.075);
  } else if (alt === -1) flat(0);
  else if (alt === -2) { flat(-SP * 0.38); flat(SP * 0.38); }
  else if (alt === 2) {
    const a = SP * 0.42, t = SP * 0.13;
    for (const r of [Math.PI / 4, -Math.PI / 4]) {
      ctx.save(); ctx.rotate(r); ctx.fillRect(-a, -t, a * 2, t * 2); ctx.restore();
    }
  }
  ctx.restore();
}

/* 音部記号だけは、あれば書体の字形を借りる。手描きより素性がよい。
   字面の高さを指定して置くので、書体が変わっても五線との比は狂わない。
   持っていない環境（U+1D11E を欠く）では、下の手描きに落ちる */
const F_MUSIC = "'Bravura', 'Noto Music', 'Segoe UI Symbol', 'Apple Symbols', serif";
const GLYPH = { g: "\u{1D11E}", f: "\u{1D122}" };
let glyphOK = null;
const hasGlyphs = (ctx) => {
  if (glyphOK !== null) return glyphOK;
  ctx.save();
  ctx.font = `100px ${F_MUSIC}`;
  const m = ctx.measureText(GLYPH.g);
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.restore();
  /* 字面が無い（0）か、豆腐（ほぼ正方形の枠）なら使わない */
  glyphOK = h > 20 && Math.abs(h / Math.max(1, m.width) - 1) > 0.25;
  return glyphOK;
};

/* 字面の高さを targetH に、指定の段に合わせて置く。
   anchor は「字面の上から何割の位置を y に合わせるか」 */
function glyph(ctx, ch, x, y, targetH, anchor) {
  ctx.font = `100px ${F_MUSIC}`;
  const m0 = ctx.measureText(ch);
  const h0 = m0.actualBoundingBoxAscent + m0.actualBoundingBoxDescent;
  if (!h0) return;
  ctx.font = `${(100 * targetH) / h0}px ${F_MUSIC}`;
  const m = ctx.measureText(ch);
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.fillText(ch, x + m.actualBoundingBoxLeft, y - h * anchor + m.actualBoundingBoxAscent);
}

/* ト音記号。渦の中心が第2線（ト）に来る */
function gClefDrawn(ctx, x, yG, SP) {
  ctx.save();
  ctx.translate(x, yG);
  ctx.scale(SP, SP);
  ctx.strokeStyle = C.sepia;
  ctx.lineWidth = 0.26; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0.62, -1.05);                                        /* 上の巻きはじめ */
  ctx.bezierCurveTo(0.62, -2.05, 0.10, -3.05, -0.32, -3.05);
  ctx.bezierCurveTo(-0.86, -3.05, -1.02, -2.30, -0.90, -1.62);
  ctx.bezierCurveTo(-0.74, -0.70, -0.20, 0.30, 0.16, 1.20);
  ctx.bezierCurveTo(0.56, 2.20, 0.74, 2.96, 0.62, 3.52);
  ctx.bezierCurveTo(0.48, 4.20, -0.16, 4.44, -0.62, 4.16);
  ctx.bezierCurveTo(-1.00, 3.92, -1.00, 3.42, -0.66, 3.30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.62, -1.05);                                        /* 大きな輪を下へ */
  ctx.bezierCurveTo(0.62, -0.32, 0.10, 0.22, -0.66, 0.58);
  ctx.bezierCurveTo(-1.58, 1.02, -2.06, 1.86, -1.86, 2.60);
  ctx.bezierCurveTo(-1.66, 3.36, -0.72, 3.72, -0.06, 3.30);
  ctx.bezierCurveTo(0.52, 2.92, 0.62, 2.06, 0.24, 1.36);
  ctx.bezierCurveTo(-0.12, 0.70, -0.86, 0.30, -1.36, 0.22);       /* 渦の中心へ */
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-1.30, 0.06, 0.30, 0, Math.PI * 2);                     /* 渦の芯 */
  ctx.fill();
  ctx.restore();
}

/* ヘ音記号。点2つが第4線（へ）を挟む */
function fClefDrawn(ctx, x, yF, SP) {
  ctx.save();
  ctx.translate(x, yF);
  ctx.scale(SP, SP);
  ctx.beginPath();
  ctx.moveTo(-0.55, -0.55);
  ctx.bezierCurveTo(-0.55, -1.20, 0.10, -1.30, 0.52, -1.02);
  ctx.bezierCurveTo(1.30, -0.50, 1.28, 0.90, 0.42, 1.90);
  ctx.bezierCurveTo(-0.14, 2.54, -0.90, 2.92, -1.50, 3.04);
  ctx.lineTo(-1.56, 2.82);
  ctx.bezierCurveTo(-0.60, 2.48, 0.30, 1.62, 0.34, 0.42);
  ctx.bezierCurveTo(0.36, -0.30, 0.02, -0.66, -0.24, -0.44);
  ctx.bezierCurveTo(-0.04, -0.10, -0.24, 0.26, -0.60, 0.24);
  ctx.bezierCurveTo(-0.94, 0.22, -1.10, -0.10, -0.98, -0.42);
  ctx.closePath();
  ctx.fill();
  for (const dy of [-0.5, 0.5]) {
    ctx.beginPath(); ctx.arc(1.30, dy, 0.17, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ト音記号は五線の下1間から上1間半まで、ヘ音記号は上の線から下1間まで */
function gClef(ctx, x, yG, SP) {
  if (!hasGlyphs(ctx)) return gClefDrawn(ctx, x, yG, SP);
  ctx.fillStyle = C.sepia;
  glyph(ctx, GLYPH.g, x - SP * 1.55, yG, SP * 7.2, 0.62);
}
function fClef(ctx, x, yF, SP) {
  if (!hasGlyphs(ctx)) return fClefDrawn(ctx, x, yF, SP);
  ctx.fillStyle = C.sepia;
  glyph(ctx, GLYPH.f, x - SP * 1.1, yF, SP * 3.3, 0.22);
}

/* 8分休符。かぎと斜めの棒 */
function rest8(ctx, x, y, SP) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(-SP * 0.24, -SP * 0.42, SP * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-SP * 0.02, -SP * 0.60);
  ctx.bezierCurveTo(SP * 0.34, -SP * 0.62, SP * 0.30, -SP * 0.20, SP * 0.10, SP * 0.42);
  ctx.lineTo(-SP * 0.08, SP * 1.00);
  ctx.lineTo(-SP * 0.26, SP * 0.96);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* 16分休符。8分にかぎをもう一つ足す */
function rest16(ctx, x, y, SP) {
  rest8(ctx, x, y - SP * 0.35, SP);
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(-SP * 0.30, SP * 0.20, SP * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* 4分休符。稲妻形 */
function rest4(ctx, x, y, SP) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = SP * 0.20; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-SP * 0.28, -SP * 0.95);
  ctx.lineTo(SP * 0.24, -SP * 0.24);
  ctx.lineTo(-SP * 0.26, SP * 0.24);
  ctx.lineTo(SP * 0.22, SP * 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(SP * 0.22, SP * 0.98);
  ctx.bezierCurveTo(-SP * 0.20, SP * 0.52, -SP * 0.44, SP * 0.86, -SP * 0.10, SP * 1.14);
  ctx.lineWidth = SP * 0.14;
  ctx.stroke();
  ctx.restore();
}

/* 2分休符は第3線の上に載り、全休符は第4線からぶら下がる */
function restBlock(ctx, x, y, SP, whole) {
  ctx.fillRect(x - SP * 0.62, whole ? y - SP * 0.5 : y, SP * 1.24, SP * 0.5);
}
const drawRest = (ctx, dur, x, y, SP) =>
  dur >= 192 ? restBlock(ctx, x, y, SP, true)
    : dur >= 96 ? restBlock(ctx, x, y, SP, false)
      : (dur >= 48 ? rest4 : dur >= 24 ? rest8 : rest16)(ctx, x, y, SP);

/* 装飾記号 */
function ornament(ctx, kind, x, y, SP) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === "mordent") {
    /* 短いぎざぎざ。マーティンのソロが終止で見せる身ぶり */
    const u = SP * 0.42;
    ctx.lineWidth = SP * 0.15; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-u * 2, 0); ctx.lineTo(-u, -u * 0.8); ctx.lineTo(0, 0);
    ctx.lineTo(u, -u * 0.8); ctx.lineTo(u * 2, 0);
    ctx.stroke();
  } else if (kind === "trill" || kind === "trill-half") {
    ctx.font = `italic ${SP * 1.9}px ${F_SERIF}`;
    ctx.textAlign = "center";
    ctx.fillText("tr", 0, 0);
  } else {                                                   /* 回音 */
    const w = SP * 0.62, h = SP * 0.34;
    ctx.lineWidth = SP * 0.16; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w * 1.6, h * 0.6);
    ctx.bezierCurveTo(-w * 1.5, -h * 1.4, -w * 0.2, -h * 1.2, 0, 0);
    ctx.bezierCurveTo(w * 0.2, h * 1.2, w * 1.5, h * 1.4, w * 1.6, -h * 0.6);
    ctx.stroke();
    if (kind === "turn-inv") {
      ctx.beginPath(); ctx.moveTo(0, -h * 1.6); ctx.lineTo(0, h * 1.6); ctx.stroke();
    }
  }
  ctx.restore();
}

/* 大括弧。先が細く中ほどが太い */
function brace(ctx, x, yT, yB, SP) {
  const half = (yB - yT) / 2, yMid = (yT + yB) / 2, k = SP * 0.62;
  ctx.beginPath();
  ctx.moveTo(x + k, yT);
  ctx.bezierCurveTo(x - k * 0.55, yT + half * 0.42, x + k * 0.85, yMid - half * 0.3, x - k * 0.15, yMid);
  ctx.bezierCurveTo(x + k * 0.85, yMid + half * 0.3, x - k * 0.55, yB - half * 0.42, x + k, yB);
  ctx.bezierCurveTo(x + k * 0.2, yB - half * 0.44, x + k * 1.5, yMid + half * 0.32, x + k * 0.55, yMid);
  ctx.bezierCurveTo(x + k * 1.5, yMid - half * 0.32, x + k * 0.2, yT + half * 0.44, x + k, yT);
  ctx.fill();
}

/* 賽の目。譜面の上に、その小節を引き当てた2つの賽を小さく刷る */
export function drawDie(ctx, x, y, s, pips, color, bg) {
  const r = s * 0.19;
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, s, s, r); else ctx.rect(x, y, s, s);
  if (bg) { ctx.fillStyle = bg; ctx.fill(); }
  ctx.lineWidth = Math.max(0.7, s * 0.055);
  ctx.strokeStyle = color; ctx.stroke();
  const P = [[0.5, 0.5]], A = [0.28, 0.5, 0.72];
  const SET = {
    1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  ctx.fillStyle = color;
  for (const [i, j] of SET[pips] || P)
    { ctx.beginPath(); ctx.arc(x + A[i] * s, y + A[j] * s, s * 0.088, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/* ─── 割りつけ ───────────────────────────────
   枡（＝書かれた1小節）の並び。第8小節だけ1番・2番の2枡になる */

export function cellsOf(plan) {
  /* plan は table.layout() が返す並び。繰り返しの2周目は譜面には出さない */
  const out = [];
  const seen = new Set();
  for (const b of plan) {
    const key = `${b.pos}:${b.volta ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

export function planPage(cells, W, opts = {}) {
  const marginX = Math.round(W * 0.035);
  const rows = opts.rows || [8, cells.length - 8];
  const keyN = opts.keyN || 0;
  const sharps = !!opts.sharps;
  const meter = opts.meter || [3, 8];
  const lead = 0, inner = W - marginX * 2;
  const SP = Math.max(5.2, Math.min(9.2, inner / 108));
  const headW = SP * (8.4 + keyN * (sharps ? 1.2 : 1.0));   /* 大括弧・音部記号・調号 */
  const staffH = SP * 4;
  const gap = SP * 6.6;                          /* 2段の五線のあいだ */
  const grand = staffH * 2 + gap;
  const sysGap = SP * 11.5;
  const top = SP * 7.5;

  const systems = [];
  let ci = 0;
  for (let r = 0; r < rows.length; r++) {
    const n = rows[r];
    const y = top + r * (grand + sysGap);
    const x0 = marginX + headW;
    const w = W - marginX - x0;
    const cw = w / n;
    const cs = [];
    for (let i = 0; i < n && ci < cells.length; i++, ci++)
      cs.push({ ...cells[ci], x: x0 + i * cw, w: cw, sys: r });
    systems.push({ y, yT: y, yB: y + staffH + gap, x0: marginX + headW, xL: marginX, w, cells: cs });
  }
  const H = top + rows.length * grand + (rows.length - 1) * sysGap + SP * 9;
  return { SP, staffH, gap, grand, systems, W, H, marginX, headW, lead, keyN, sharps, meter };
}

/* 枡の中の横位置。両手で共通の時間軸を使う。
   1小節の長さは枡ごとに持つ（フィナーレは 6/8 になる） */
const tickX = (cell, t, SP) => {
  const lead = SP * 1.5, trail = SP * 1.1;
  const T = cell.written?.ticks || BAR_TICKS;
  return cell.x + lead + (t / T) * (cell.w - lead - trail);
};

const yOf = (g, sys, staff, step) =>
  (staff ? sys.yT : sys.yB) + (topStep(staff) - step) * (g.SP / 2);

/* ─── 描画 ─────────────────────────────── */

function paper(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#efe6cf"); g.addColorStop(0.55, C.paper); g.addColorStop(1, "#e0d4b6");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.paper2;
  for (let i = 0; i < 900; i++) ctx.fillRect((i * 197.3) % W, (i * 113.7) % H, 1, 1);
  ctx.fillStyle = "rgba(120,96,58,0.05)";
  for (let i = 0; i < 60; i++) {
    const x = (i * 613.7) % W, y = (i * 271.3) % H, r = 4 + ((i * 37) % 22);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function staffLines(ctx, g, sys, x1, x2) {
  ctx.strokeStyle = C.sepiaSoft; ctx.lineWidth = Math.max(0.7, g.SP * 0.09);
  for (const yTop of [sys.yT, sys.yB])
    for (let i = 0; i < 5; i++) {
      const y = Math.round(yTop + i * g.SP) + 0.5;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    }
}

function barline(ctx, g, sys, x, kind) {
  const yA = sys.yT, yB = sys.yB + g.staffH;
  ctx.fillStyle = C.sepia;
  const thin = Math.max(0.9, g.SP * 0.11), thick = g.SP * 0.42;
  const dots = (dx) => {
    for (const yTop of [sys.yT, sys.yB])
      for (const dy of [1.5, 2.5]) {
        ctx.beginPath();
        ctx.arc(dx, yTop + dy * g.SP, g.SP * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
  };
  if (kind === "open") {
    ctx.fillRect(x, yA, thick, yB - yA);
    ctx.fillRect(x + thick + g.SP * 0.28, yA, thin, yB - yA);
    dots(x + thick + g.SP * 0.95);
  } else if (kind === "close") {
    dots(x - thick - g.SP * 0.95);
    ctx.fillRect(x - thick - g.SP * 0.28 - thin, yA, thin, yB - yA);
    ctx.fillRect(x - thick, yA, thick, yB - yA);
  } else if (kind === "final") {
    ctx.fillRect(x - thick, yA, thick, yB - yA);
    ctx.fillRect(x - thick - g.SP * 0.28 - thin, yA, thin, yB - yA);
  } else {
    ctx.fillRect(x, yA, thin, yB - yA);
  }
}

/* 調号。[低音部, 高音部] の順（譜表の番号 0=低音部 に合わせる） */
const FLAT_STEPS = [[20, 34], [23, 37], [19, 33]];   /* 変ロ・変ホ・変イ */
const SHARP_STEPS = [[24, 38], [21, 35], [25, 39]];  /* 嬰ヘ・嬰ハ・嬰ト */
function keySig(ctx, g, sys, x, n, sharps) {
  const table = sharps ? SHARP_STEPS : FLAT_STEPS;
  const alt = sharps ? 1 : -1;
  ctx.fillStyle = C.sepia;
  for (let i = 0; i < n && i < table.length; i++)
    for (const staff of [0, 1])
      drawAcc(ctx, alt, x + i * g.SP * (sharps ? 1.15 : 0.95) + g.SP * 0.5,
        yOf(g, sys, staff, table[i][staff]), g.SP);
}

/* 拍子記号。数字は五線に合わせて縦長に */
function timeSig(ctx, g, sys, x, num, den) {
  ctx.fillStyle = C.sepia;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const yTop of [sys.yT, sys.yB]) {
    ctx.save();
    ctx.translate(x, yTop + g.SP * 2);
    ctx.scale(1, 1.16);
    ctx.font = `600 ${g.SP * 2.2}px ${F_SERIF}`;
    ctx.fillText(String(num), 0, -g.SP * 0.92);
    ctx.fillText(String(den), 0, g.SP * 0.92);
    ctx.restore();
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

/* 加線 */
function ledgers(ctx, g, sys, staff, x, step) {
  const top = topStep(staff), bot = top - 8;
  ctx.strokeStyle = C.sepia; ctx.lineWidth = Math.max(0.9, g.SP * 0.11);
  const line = (s) => {
    const y = Math.round(yOf(g, sys, staff, s)) + 0.5;
    ctx.beginPath(); ctx.moveTo(x - g.SP * 1.02, y); ctx.lineTo(x + g.SP * 1.02, y); ctx.stroke();
  };
  for (let s = top + 2; s <= step; s += 2) line(s);
  for (let s = bot - 2; s >= step; s -= 2) line(s);
}

/* 記譜上の符尾（連桁）の本数。連符は実際の音価と記譜が食い違うので、
   生成側が beams を持たせてきたらそちらを優先する */
const nBeams = (e) => e.beams || (e.dur >= 24 ? 1 : e.dur >= 12 ? 2 : e.dur >= 6 ? 3 : 4);

/* 1つの声部を組む。連桁・符幹・臨時記号・装飾まで */
function drawVoice(ctx, g, sys, cell, voice, up, alpha, active) {
  const SP = g.SP, staff = voice.staff;
  const ev = voice.ev;
  ctx.fillStyle = ctx.strokeStyle = C.sepia;

  /* 連桁の束を先に見つける */
  const groups = [];
  let open = null;
  ev.forEach((e, i) => {
    if (e.rest) { open = null; return; }
    if (e.beamL) { open = { from: i, to: i }; groups.push(open); }
    else if (open) open.to = i;
    if (e.beamJ && open) open = null;
  });
  const inBeam = new Set();
  for (const gr of groups) for (let i = gr.from; i <= gr.to; i++) inBeam.add(i);

  const xs = ev.map((e) => tickX(cell, e.t, SP));
  const stemX = (i) => {
    const e = ev[i];
    if (e.rest) return xs[i];
    const s = up ? e.notes[e.notes.length - 1].step : e.notes[0].step;
    return xs[i] + (up ? SP * 0.60 : -SP * 0.60) * 1 + 0 * s;
  };
  const tipY = (i) => {
    const e = ev[i];
    const s = up ? e.notes[e.notes.length - 1].step : e.notes[0].step;
    const extra = Math.max(0, nBeams(e) - 2) * SP * 0.72;   /* 連桁が増えるぶん逃がす */
    return yOf(g, sys, staff, s) + (up ? -(SP * 3.1 + extra) : SP * 3.1 + extra);
  };

  /* 連桁の傾き。両端の符頭を結び、傾きを抑える */
  const beamY = new Map();
  for (const gr of groups) {
    const a = gr.from, b = gr.to;
    let y0 = tipY(a), y1 = tipY(b);
    const maxSlope = SP * 0.55;
    const mid = (y0 + y1) / 2;
    let d = Math.max(-maxSlope, Math.min(maxSlope, (y1 - y0) / 2));
    y0 = mid - d; y1 = mid + d;
    /* どの符頭からも短すぎる棒にならないよう引き上げる */
    for (let i = a; i <= b; i++) {
      const t = (stemX(i) - stemX(a)) / Math.max(1e-6, stemX(b) - stemX(a));
      const y = y0 + (y1 - y0) * t, need = tipY(i);
      if (up && y > need) { const k = y - need; y0 -= k; y1 -= k; }
      if (!up && y < need) { const k = need - y; y0 += k; y1 += k; }
    }
    gr.y0 = y0; gr.y1 = y1;
    for (let i = a; i <= b; i++) {
      const t = (stemX(i) - stemX(a)) / Math.max(1e-6, stemX(b) - stemX(a));
      beamY.set(i, y0 + (y1 - y0) * t);
    }
  }

  ev.forEach((e, i) => {
    const x = xs[i];
    const lit = active && active.has(e);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ctx.strokeStyle = lit ? C.red : C.sepia;

    if (e.rest) {
      drawRest(ctx, e.dur, x, yOf(g, sys, staff, topStep(staff) - 4), SP);
      return;
    }

    /* 加線と符頭 */
    for (const n of e.notes) {
      ledgers(ctx, g, sys, staff, x, n.step);
      head(ctx, x, yOf(g, sys, staff, n.step), SP, e.dur < 96);   /* 2分音符から白 */
    }

    /* 臨時記号。縦に近いものだけ左へ送る */
    const cols = [];
    [...e.notes].sort((a, b) => b.step - a.step).forEach((n) => {
      if (!n.showAcc) return;
      let c = cols.findIndex((last) => last - n.step >= 5);
      if (c < 0) { c = cols.length; cols.push(n.step); } else cols[c] = n.step;
      const wA = SP * (ACC_W[n.alter] || 1);
      drawAcc(ctx, n.alter, x - SP * 1.0 - c * (wA + SP * 0.18) - wA / 2, yOf(g, sys, staff, n.step), SP);
    });

    /* 符幹 */
    if (e.dur < 96) {
      const sx = x + (up ? SP * 0.60 : -SP * 0.60);
      const rootStep = up ? e.notes[0].step : e.notes[e.notes.length - 1].step;
      const y0 = yOf(g, sys, staff, rootStep);
      const y1 = beamY.has(i) ? beamY.get(i) : tipY(i);
      ctx.lineWidth = Math.max(1, SP * 0.11);
      ctx.beginPath(); ctx.moveTo(sx, y0); ctx.lineTo(sx, y1); ctx.stroke();
      /* 連桁に入らない8分・16分には旗を立てる */
      if (!inBeam.has(i) && e.dur < 48) {
        const n = nBeams(e);
        for (let k = 0; k < n; k++) {
          const yy = y1 + (up ? 1 : -1) * k * SP * 0.78;
          ctx.beginPath();
          ctx.moveTo(sx, yy);
          ctx.quadraticCurveTo(sx + SP * 1.05, yy + (up ? SP * 0.62 : -SP * 0.62),
            sx + SP * 0.70, yy + (up ? SP * 1.72 : -SP * 1.72));
          ctx.lineWidth = Math.max(1, SP * 0.15);
          ctx.stroke();
        }
      }
    }

    /* 装飾記号とスタッカーティシモ */
    const hi = e.notes[e.notes.length - 1].step, lo = e.notes[0].step;
    if (e.orn)
      ornament(ctx, e.orn, x, yOf(g, sys, staff, Math.max(hi, topStep(staff) + 1)) - SP * 1.2, SP);
    if (e.stacc) {
      const above = !up;
      const y = yOf(g, sys, staff, above ? hi : lo) + (above ? -SP * 1.15 : SP * 1.15);
      ctx.beginPath();
      if (e.stacc === 2) {
        ctx.moveTo(x - SP * 0.22, y + (above ? SP * 0.42 : -SP * 0.42));
        ctx.lineTo(x + SP * 0.22, y + (above ? SP * 0.42 : -SP * 0.42));
        ctx.lineTo(x, y - (above ? SP * 0.42 : -SP * 0.42));
        ctx.closePath(); ctx.fill();
      } else { ctx.arc(x, y, SP * 0.15, 0, Math.PI * 2); ctx.fill(); }
    }
  });

  /* 連桁。主連桁を通し、16分の続くところだけ副連桁を重ねる */
  ctx.globalAlpha = alpha;
  ctx.fillStyle = C.sepia;
  const bt = SP * 0.46;
  for (const gr of groups) {
    if (gr.from === gr.to) continue;
    const xa = stemX(gr.from), xb = stemX(gr.to);
    const beam = (y0, y1, xA, xB, off) => {
      const s = (y1 - y0) / Math.max(1e-6, xb - xa);
      const ya = y0 + (xA - xa) * s + off, yb = y0 + (xB - xa) * s + off;
      ctx.beginPath();
      ctx.moveTo(xA, ya); ctx.lineTo(xB, yb);
      ctx.lineTo(xB, yb + bt * (up ? 1 : -1)); ctx.lineTo(xA, ya + bt * (up ? 1 : -1));
      ctx.closePath(); ctx.fill();
    };
    beam(gr.y0, gr.y1, xa, xb, 0);
    /* 副連桁。16分は2本、32分は3本。続いている範囲だけ重ねる */
    for (let lvl = 2; lvl <= 4; lvl++) {
      const off = (up ? 1 : -1) * bt * 1.55 * (lvl - 1);
      let run = null;
      for (let i = gr.from; i <= gr.to + 1; i++) {
        const short = i <= gr.to && nBeams(ev[i]) >= lvl;
        if (short && run === null) run = i;
        if (!short && run !== null) {
          const a = run, b = i - 1;
          if (a === b) {
            const xm = stemX(a), dir = a === gr.from ? 1 : -1;
            beam(gr.y0, gr.y1, xm, xm + dir * SP * 0.9, off);
          } else beam(gr.y0, gr.y1, stemX(a), stemX(b), off);
          run = null;
        }
      }
    }
    /* 連符の数字。連桁の外側に小さく */
    if (ev[gr.from].tuplet) {
      const xm = (xa + xb) / 2, ym = (gr.y0 + gr.y1) / 2;
      ctx.font = `italic ${SP * 1.25}px ${F_SERIF}`;
      ctx.textAlign = "center";
      ctx.fillText(String(ev[gr.from].tuplet), xm, ym + (up ? -SP * 0.55 : SP * 1.55));
      ctx.textAlign = "left";
    }
  }
  ctx.globalAlpha = 1;
}

/* 臨時記号を出すかどうかを小節ごとに決める。調号にある音には付けない */
const FLAT_LETTERS = [6, 2, 5, 1, 4, 0, 3];      /* ロ ホ イ ニ ト ハ ヘ */
const SHARP_LETTERS = [3, 0, 4, 1, 5, 2, 6];     /* ヘ ハ ト ニ イ ホ ロ */
function markAccidentals(written, keyN, sharps) {
  const key = new Map();
  const letters = sharps ? SHARP_LETTERS : FLAT_LETTERS;
  for (let i = 0; i < keyN; i++) key.set(letters[i], sharps ? 1 : -1);
  const state = new Map();
  const all = [];
  for (const st of written.staves) for (const v of st) for (const e of v.ev) if (!e.rest) all.push(e);
  all.sort((a, b) => a.t - b.t);
  for (const e of all)
    for (const n of e.notes) {
      const k = `${n.step}`;
      const prev = state.has(k) ? state.get(k) : (key.get(n.letter) || 0);
      n.showAcc = n.alter !== prev;
      state.set(k, n.alter);
    }
}

export function drawPage(ctx, g, opts) {
  const { revealed = 99, active = null, activeCell = -1, showDice = true, showNums = true,
    title = null, subtitle = null } = opts;
  const SP = g.SP;
  paper(ctx, g.W, g.H);

  /* 変奏の題。主題のときは出さない（賽の目と札の番号がその場所を使う） */
  if (title) {
    ctx.fillStyle = C.sepia;
    ctx.font = `italic ${SP * 2.5}px ${F_SERIF}`;
    ctx.fillText(title, g.marginX, SP * 4.2);
    if (subtitle) {
      const w = ctx.measureText(title).width;
      ctx.font = `${SP * 1.35}px ${F_SERIF}`;
      ctx.fillStyle = "rgba(51,38,26,0.6)";
      ctx.fillText(subtitle, g.marginX + w + SP * 1.4, SP * 4.2);
    }
  }

  g.systems.forEach((sys, si) => {
    const last = sys.cells[sys.cells.length - 1];
    const xEnd = last ? last.x + last.w : sys.x0;
    staffLines(ctx, g, sys, sys.xL, xEnd);

    ctx.fillStyle = C.sepia;
    brace(ctx, sys.xL + SP * 0.4, sys.yT, sys.yB + g.staffH, SP);
    ctx.fillRect(sys.xL + SP * 1.35, sys.yT, Math.max(0.9, SP * 0.11), sys.yB + g.staffH - sys.yT);

    gClef(ctx, sys.xL + SP * 3.5, sys.yT + SP * 3, SP);
    fClef(ctx, sys.xL + SP * 3.1, sys.yB + SP * 1, SP);
    if (g.keyN) keySig(ctx, g, sys, sys.xL + SP * 5.2, g.keyN, g.sharps);
    if (si === 0) timeSig(ctx, g, sys, sys.xL + SP * (6.6 + g.keyN * (g.sharps ? 1.2 : 0.95)), g.meter[0], g.meter[1]);

    /* 縦線 */
    sys.cells.forEach((cell, i) => {
      const isLastOfPiece = si === g.systems.length - 1 && i === sys.cells.length - 1;
      const endsFirstHalf = cell.pos === 8 && cell.volta === 0;
      barline(ctx, g, sys, cell.x + cell.w,
        isLastOfPiece ? "final" : endsFirstHalf ? "close" : "plain");
    });
    if (si === 0) barline(ctx, g, sys, sys.x0 - SP * 1.35, "open");

    /* 括弧 */
    sys.cells.forEach((cell) => {
      if (cell.pos !== 8) return;
      const n = cell.volta === 0 ? "1." : "2.";
      const y = sys.yT - SP * 3.2;
      /* 1番括弧は縦線で閉じない（そのまま繰り返しに戻る）、2番括弧は閉じる */
      const xa = cell.x + SP * 0.2, xb = cell.x + cell.w - SP * 0.5;
      ctx.strokeStyle = C.sepia; ctx.lineWidth = Math.max(0.9, SP * 0.11);
      ctx.beginPath();
      ctx.moveTo(xa, y + SP * 1.6);
      ctx.lineTo(xa, y);
      ctx.lineTo(xb, y);
      if (cell.volta === 1) ctx.lineTo(xb, y + SP * 1.6);
      ctx.stroke();
      ctx.fillStyle = C.sepia;
      ctx.font = `${SP * 1.35}px ${F_SERIF}`;
      ctx.fillText(n, xa + SP * 0.45, y + SP * 1.3);
    });

    /* 中身 */
    sys.cells.forEach((cell) => {
      const shown = cell.pos <= revealed;
      if (!shown || !cell.written) return;
      const fade = cell.fade == null ? 1 : cell.fade;

      if (cell.pos === activeCell) {
        ctx.fillStyle = "rgba(176,138,60,0.16)";
        ctx.fillRect(cell.x, sys.yT - SP * 1.4, cell.w, sys.yB + g.staffH - sys.yT + SP * 2.8);
      }

      markAccidentals(cell.written, g.keyN, g.sharps);
      for (const st of cell.written.staves) {
        const layers = st.filter((v) => v.ev.length);
        /* 符幹の向き。声部が2つ重なっていれば上の声部が上向き、
           1つだけなら中央線から遠いほうの音に従う（版面の作法） */
        const mean = (x) => {
          const ns = x.ev.filter((e) => !e.rest).flatMap((e) => e.notes.map((n) => n.step));
          return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0;
        };
        const top = Math.max(...layers.map(mean));
        layers.forEach((v) => {
          let up;
          if (layers.length > 1) up = mean(v) >= top;
          else {
            const mid = topStep(v.staff) - 4;
            const ns = v.ev.filter((e) => !e.rest).flatMap((e) => e.notes.map((n) => n.step));
            up = ns.length ? Math.max(...ns) - mid <= mid - Math.min(...ns) : true;
          }
          drawVoice(ctx, g, sys, cell, v, up, fade, cell.pos === activeCell ? active : null);
        });
      }

      /* 小節の頭書き。出目の2つの賽と、引き当てた札の番号 */
      ctx.globalAlpha = fade;
      const yTop = sys.yT - SP * (cell.pos === 8 ? 5.6 : 3.2);
      if (showDice && cell.dice) {
        const s = SP * 1.5;
        drawDie(ctx, cell.x + SP * 0.5, yTop - s, s, cell.dice[0], C.sepiaSoft);
        drawDie(ctx, cell.x + SP * 0.5 + s + SP * 0.3, yTop - s, s, cell.dice[1], C.sepiaSoft);
      }
      if (showNums && cell.no != null) {
        ctx.fillStyle = C.red;
        ctx.font = `${SP * 1.15}px ${F_MONO}`;
        ctx.fillText(`№${cell.no}`, cell.x + SP * (showDice && cell.dice ? 4.2 : 0.5), yTop - SP * 0.25);
      }
      ctx.globalAlpha = 1;
    });
  });
}
