/* ══════════════════════════════════════════════════════════════
   鍵盤 — アントン・ヴァルターの音域

   1780年代ウィーンのフォルテピアノは FF–f³ の5オクターヴ、61鍵。
   この曲に出てくる音は C2–D6 なので、ちょうど収まる。

   当時のウィーンの楽器は、いまと白黒が逆のものが多かった。
   幹音が黒檀、派生音が象牙か骨。既定ではその見た目にしてある。
   ══════════════════════════════════════════════════════════════ */

export const KB_LO = 29;                      /* FF */
export const KB_HI = 89;                      /* f³ */
const BLACK_PC = new Set([1, 3, 6, 8, 10]);
export const isBlack = (m) => BLACK_PC.has(((m % 12) + 12) % 12);
/* 黒鍵は白鍵の境目ちょうどではなく、3つ組・2つ組の中で振り分ける */
const OFF = { 1: -0.06, 3: 0.06, 6: -0.10, 8: 0, 10: 0.10 };

export const KB = (() => {
  const white = [], at = {};
  for (let m = KB_LO; m <= KB_HI; m++) if (!isBlack(m)) { at[m] = white.length; white.push(m); }
  return { white, at, count: white.length };
})();

export const keyX = (midi, w) => {
  const m = Math.max(KB_LO, Math.min(KB_HI, midi)), kw = w / KB.count;
  if (!isBlack(m)) return (KB.at[m] + 0.5) * kw;
  return (KB.at[m - 1] + 1 + OFF[((m % 12) + 12) % 12]) * kw;
};

/* active: Map<midi, {vel, hand, age}> age は 0（今）から 1（消えた）まで */
export function drawKeys(ctx, x, y, w, h, active, opts = {}) {
  const { period = true, paper = "#e9dfc6", ink = "#0e0c18" } = opts;
  const natural = period ? "#241f28" : paper;
  const naturalEdge = period ? "#5c5262" : "#b3a582";
  const sharp = period ? "#e4d9bd" : "#181520";
  const litW = "#c9a04f", litB = "#e2be6a";

  ctx.save();
  ctx.translate(x, y);

  /* 譜面台の下の木地。黒い幹音が背景に溶けないように、必ず枠を敷く */
  ctx.fillStyle = period ? "#4a3524" : "#3a2c1e";
  ctx.fillRect(-3, -3, w + 6, h + 6);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-3, h, w + 6, 3);

  /* 前縁のフェルト */
  const felt = Math.max(2, h * 0.045);
  ctx.fillStyle = "#7d2230";
  ctx.fillRect(0, 0, w, felt);
  const top = felt, kh = h - felt;
  const kw = w / KB.count, bw = kw * 0.62, bh = kh * 0.62;
  const rad = Math.min(3, kw * 0.22);
  const box = (bx, by, bw2, bh2) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw2, bh2, [0, 0, rad, rad]);
    else ctx.rect(bx, by, bw2, bh2);
  };

  KB.white.forEach((m, i) => {
    const hit = active.get(m);
    const kx = i * kw;
    const down = hit ? Math.max(0, 1 - hit.age) : 0;
    if (hit) ctx.fillStyle = litW;
    else {
      const g = ctx.createLinearGradient(0, top, 0, top + kh);
      if (period) { g.addColorStop(0, "#2e2833"); g.addColorStop(1, "#16131b"); }
      else { g.addColorStop(0, "#f2e9d5"); g.addColorStop(1, "#d8c9a9"); }
      ctx.fillStyle = g;
    }
    box(kx + 0.5, top + down * 2, kw - 1, kh - down * 2);
    ctx.fill();
    ctx.strokeStyle = naturalEdge; ctx.lineWidth = 1; ctx.stroke();
    if (hit) {
      ctx.globalAlpha = down * 0.5;
      ctx.fillStyle = litB;
      ctx.fillRect(kx + 0.5, top, kw - 1, kh * 0.22);
      ctx.globalAlpha = 1;
    }
  });

  for (let m = KB_LO; m <= KB_HI; m++) {
    if (!isBlack(m)) continue;
    const hit = active.get(m);
    const cx = keyX(m, w);
    const down = hit ? Math.max(0, 1 - hit.age) : 0;
    ctx.fillStyle = hit ? litB : sharp;
    box(cx - bw / 2, top + down * 2, bw, bh - down * 2);
    ctx.fill();
    if (!hit) {
      ctx.fillStyle = period ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.10)";
      box(cx - bw / 2, top, bw, bh * 0.14); ctx.fill();
    }
  }

  /* ハの位置。中央ハだけ色を変える */
  if (kw > 8) {
    ctx.font = `${Math.min(9, kw * 0.5)}px Cousine, monospace`;
    ctx.textAlign = "center";
    KB.white.forEach((m, i) => {
      if (m % 12) return;
      ctx.fillStyle = m === 60 ? "#9a2a2c" : (period ? "rgba(220,210,190,0.35)" : "rgba(51,38,26,0.4)");
      ctx.fillText("C" + (m / 12 - 1), i * kw + kw / 2, top + kh - 4);
    });
    ctx.textAlign = "left";
  }
  ctx.restore();
}

/* 譜面から鍵へ落ちる光。いま鳴っている音の上に立てる */
export function drawGlow(ctx, x, y, w, hAbove, active) {
  ctx.save();
  for (const [m, s] of active) {
    const kx = x + keyX(m, w);
    const a = Math.max(0, 1 - s.age) * 0.5 * (0.4 + s.vel);
    if (a <= 0.01) continue;
    const g = ctx.createLinearGradient(kx, y - hAbove, kx, y);
    g.addColorStop(0, "rgba(226,190,106,0)");
    g.addColorStop(1, `rgba(226,190,106,${a.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(kx - 5, y - hAbove, 10, hAbove);
  }
  ctx.restore();
}
