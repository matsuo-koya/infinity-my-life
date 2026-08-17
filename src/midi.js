/* ══════════════════════════════════════════════════════════════
   書き出し — 標準MIDIファイル（SMF format 1）と、譜面の刷り

   賽が決めた並びは、こちらの機械の外へ持ち出せたほうがよい。
   ══════════════════════════════════════════════════════════════ */

const PPQ = 480;

const vlq = (n) => {
  const out = [n & 0x7f];
  n >>= 7;
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return out;
};
const be32 = (n) => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const chunk = (id, body) => [...id].map((c) => c.charCodeAt(0)).concat(be32(body.length), body);

const text = (type, s) => {
  const b = [...new TextEncoder().encode(s)];
  return [0x00, 0xff, type, ...vlq(b.length), ...b];
};

/* notes は perform.schedule() が返すもの。秒で持っているので拍に直す */
export function toSMF(notes, { bpm = 120, title = "Menuett", staffTracks = true } = {}) {
  const spq = 60 / bpm;
  const tick = (sec) => Math.max(0, Math.round((sec / spq) * PPQ));

  const meta = [
    ...text(0x03, title),
    ...text(0x02, "W. A. Mozart? — Musikalisches Würfelspiel K.516f"),
    0x00, 0xff, 0x51, 0x03, ...[(Math.round(6e7 / bpm) >> 16) & 255, (Math.round(6e7 / bpm) >> 8) & 255, Math.round(6e7 / bpm) & 255],
    0x00, 0xff, 0x58, 0x04, 3, 3, 24, 8,          /* 3/8 */
    0x00, 0xff, 0x59, 0x02, 0, 0,                  /* ハ長調 */
    0x00, 0xff, 0x2f, 0x00,
  ];

  const parts = staffTracks ? [0, 1] : [null];
  const tracks = parts.map((staff, i) => {
    const list = notes.filter((n) => staff === null || n.staff === staff);
    const ev = [];
    for (const n of list) {
      ev.push({ t: tick(n.t), d: [0x90 | i, n.midi & 127, Math.max(1, Math.min(127, Math.round(n.vel * 110)))] });
      ev.push({ t: tick(n.t + n.dur), d: [0x80 | i, n.midi & 127, 0] });
    }
    ev.sort((a, b) => a.t - b.t || (a.d[0] & 0xf0) - (b.d[0] & 0xf0));
    const body = [...text(0x03, staff === 1 ? "Rechte Hand" : "Linke Hand"),
      0x00, 0xc0 | i, 6];                          /* ハープシコード＝いちばん近い音色 */
    let prev = 0;
    for (const e of ev) { body.push(...vlq(e.t - prev), ...e.d); prev = e.t; }
    body.push(0x00, 0xff, 0x2f, 0x00);
    return chunk("MTrk", body);
  });

  const header = chunk("MThd", [0, 1, 0, tracks.length + 1, (PPQ >> 8) & 255, PPQ & 255]);
  return new Uint8Array([...header, ...chunk("MTrk", meta), ...tracks.flat()]);
}

export function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
