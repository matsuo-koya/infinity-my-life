/* ══════════════════════════════════════════════════════════════
   録画のこま — 画面そのままではなく、1280×720 を別に組んで録る

   上から、題字／賽と出目表／譜面／鍵盤。
   賽が転がり、表の枡が灯り、譜面が書かれ、鍵が沈む。
   一本の映像の中で、この機械の全部が見えるようにしてある。
   ══════════════════════════════════════════════════════════════ */

import { C, drawDie } from "./engrave.js";
import { BARS, DIAL, CHORDS, pick } from "./progressions.js";
import { drawKeys, drawGlow } from "./keyboard.js";

export const REC_W = 1280, REC_H = 720;
export const SCORE_W = 872;

const F_SERIF = "'Cormorant Garamond', Georgia, 'Hiragino Mincho ProN', serif";
const F_MONO = "Cousine, 'Courier New', monospace";
const F_JA = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";

/* 録れる形式。上から順に試す。mp4 が通る環境では mp4 で録る */
export const REC_FORMATS = [
  { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: 'video/webm;codecs="vp9,opus"', ext: "webm" },
  { mime: 'video/webm;codecs="vp8,opus"', ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];
export const pickFormat = () => {
  if (typeof MediaRecorder === "undefined") return null;
  return REC_FORMATS.find((f) => { try { return MediaRecorder.isTypeSupported(f.mime); } catch (e) { return false; } }) || null;
};

const TAB = { x: 210, y: 56, w: 1040, h: 120 };
export const ERA_COLOR = { "1787": "#7d94b8", mix: "#e2be6a", "1965": "#c9705a", both: "#9aa7b8" };
const DICE = { x: 30, y: 64, s: 52 };
const SCORE_Y = 200;
const KEYS = { x: 30, w: REC_W - 60, y: 616, h: 84 };

function drawTable(ctx, sums, cursor) {
  const { x, y, w, h } = TAB;
  const cw = w / BARS;
  ctx.textBaseline = "middle";

  ctx.font = `9px ${F_MONO}`;
  ctx.fillStyle = "rgba(138,131,156,0.75)";
  ctx.textAlign = "right";
  ctx.fillText("1787", x - 8, y + 22);
  ctx.fillText("1965", x - 8, y + h - 10);
  ctx.textAlign = "center";

  for (let i = 0; i < BARS; i++) {
    const cx = x + i * cw;
    const lit = sums[i] != null;
    const p = lit ? pick(i, sums[i]) : null;
    const list = DIAL[i];
    for (let j = 0; j < list.length; j++) {
      const n = list.length;
      const yy = y + 14 + (n === 1 ? (h - 42) / 2 : (j / (n - 1)) * (h - 42));
      const on = lit && list[j] === p.key;
      const era = n === 1 ? "both" : j === 0 ? "1787" : j === n - 1 ? "1965" : "mix";
      ctx.fillStyle = on ? ERA_COLOR[era] : "rgba(255,255,255,0.06)";
      ctx.fillRect(cx + 3, yy, cw - 6, 16);
      ctx.fillStyle = on ? "#0b0f14" : "rgba(226,220,239,0.28)";
      ctx.font = `${on ? "700 " : ""}10px ${F_MONO}`;
      ctx.fillText(CHORDS[list[j]].name, cx + cw / 2, yy + 8);
    }
    ctx.fillStyle = i === cursor ? C.goldLit : "rgba(138,131,156,0.55)";
    ctx.font = `9px ${F_MONO}`;
    ctx.fillText(String(i + 1), cx + cw / 2, y + 5);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

/* st = { sums, cursor, dice, score(canvas), scoreH, keys(Map), caption, code, remaining, phase } */
export function drawFrame(ctx, st) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, REC_W, REC_H);
  /* 紙の目のようなむら */
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let i = 0; i < 140; i++) ctx.fillRect((i * 271.7) % REC_W, (i * 173.3) % REC_H, 2, 2);

  /* 題字 */
  ctx.fillStyle = C.text;
  ctx.font = `300 30px ${F_SERIF}`;
  ctx.fillText("INFINITY MY LIFE", 30, 38);
  const tw = ctx.measureText("INFINITY MY LIFE").width;
  ctx.font = `10px ${F_MONO}`;
  ctx.fillStyle = C.gold;
  ctx.fillText("1787 WÜRFELSPIEL × 1965 VARISPEED — 半速のバロック", 30 + tw + 26, 36);
  ctx.textAlign = "right";
  ctx.fillStyle = st.code ? C.goldLit : C.mute;
  ctx.font = `13px ${F_MONO}`;
  ctx.fillText(st.code ? `№ ${st.code}` : `${st.sums.length} / ${BARS}`, REC_W - 30, 36);
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(176,138,60,0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, 48.5); ctx.lineTo(REC_W - 30, 48.5); ctx.stroke();

  /* 賽 */
  const { x, y, s } = DICE;
  for (let i = 0; i < 2; i++) {
    const v = st.dice[i] || 0;
    drawDie(ctx, x + i * (s + 14), y, s, v || 1,
      v ? "#2a2018" : "rgba(120,112,140,0.3)", v ? C.paper : "rgba(255,255,255,0.04)");
  }
  ctx.font = `16px ${F_MONO}`;
  ctx.fillStyle = C.goldLit;
  ctx.textAlign = "center";
  ctx.fillText(st.dice[0] ? `${st.dice[0]}+${st.dice[1]} = ${st.dice[0] + st.dice[1]}` : "—",
    x + s + 7, y + s + 26);
  ctx.font = `9.5px ${F_MONO}`;
  ctx.fillStyle = C.mute;
  ctx.fillText(st.remaining || "", x + s + 7, y + s + 46);
  ctx.textAlign = "left";

  /* 出目表 */
  drawTable(ctx, st.sums, st.cursor);

  /* いま鳴っている楽章 */
  if (st.movement) {
    ctx.font = `italic 15px ${F_SERIF}`;
    ctx.fillStyle = C.goldLit;
    ctx.textAlign = "center";
    ctx.fillText(st.movement, REC_W / 2, SCORE_Y - 6);
    ctx.textAlign = "left";
  }

  /* 譜面 */
  if (st.score) {
    const sx = (REC_W - SCORE_W) / 2;
    const maxH = KEYS.y - 14 - SCORE_Y;
    const k = Math.min(1, maxH / st.scoreH);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.drawImage(st.score, sx, SCORE_Y, SCORE_W * k, st.scoreH * k);
    ctx.restore();
    /* 鳴っている音から鍵へ落ちる光 */
    if (st.keys && st.keys.size) drawGlow(ctx, KEYS.x, KEYS.y, KEYS.w, 46, st.keys);
  }

  /* 鍵盤 */
  drawKeys(ctx, KEYS.x, KEYS.y, KEYS.w, KEYS.h, st.keys || new Map(), { period: st.period !== false });

  /* 実況 */
  if (st.caption) {
    ctx.font = `14px ${F_JA}`;
    ctx.fillStyle = "rgba(226,220,239,0.75)";
    ctx.fillText(st.caption, 30, REC_H - 6);
  }
}
