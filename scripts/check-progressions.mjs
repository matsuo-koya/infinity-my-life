/* ダイヤルと音型の検算。
   ・両端が 1787 / 1965 の進行を正しく再現するか
   ・どの目でも、どの楽章でも、拍が埋まるか
   ・音がヴァルターの鍵盤（FF–f³）に収まるか  */

import { pathOf, skeleton, CHORDS, DIAL, AGREED, TOTAL, pick } from "../src/progressions.js";
import { MOVEMENTS, build, plan } from "../src/figuration.js";

const fail = [];
const ok = (c, m) => console.log(`${c ? "  ○" : "  ×"} ${m}`) || (c || fail.push(m));

const names = (sums) => pathOf(sums).map((p) => CHORDS[p.key].name).join(" ");
console.log("ダイヤル");
ok(names(Array(16).fill(2)) === "A A E A B7 E B7 E7 B7 E A E A A E7 A",
  `和が2 → 1787年の骨（${names(Array(16).fill(2))}）`);
ok(names(Array(16).fill(12)) === "A E F♯m A7 D Dm A A A E F♯m A7 D Dm A A",
  `和が12 → 1965年の進行（${names(Array(16).fill(12))}）`);
ok(DIAL.length === 16, `16小節ぶんある`);
ok(AGREED === DIAL.filter((l) => l.length === 1).length, `もともと一致するのは ${AGREED} か所`);
ok(TOTAL > 0n, `和声の道順 ${TOTAL.toLocaleString()} 通り`);

console.log("音型");
let bad = 0, lo = 999, hi = -1, notes = 0;
for (let t = 0; t < 120; t++) {
  const sums = Array.from({ length: 16 }, () => 2 + Math.floor(Math.random() * 11));
  const skel = skeleton(pathOf(sums));
  for (let k = 0; k < MOVEMENTS.length; k++) {
    const M = build(k, skel, sums);
    for (const c of M.cells)
      for (const st of c.written.staves) {
        const v = st[0];
        if (!v || v.t !== c.written.ticks) { bad++; continue; }
        for (const e of v.ev) for (const n of (e.rest ? [] : e.notes)) {
          notes++; lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi);
        }
      }
  }
}
ok(bad === 0, `120通り×${MOVEMENTS.length}楽章、拍のずれ ${bad}`);
ok(lo >= 29 && hi <= 89, `音域 MIDI ${lo}–${hi}（鍵盤は 29–89）`);
console.log(`\n  のべ ${notes.toLocaleString()} 音を確かめた`);

if (fail.length) { console.error(`\n${fail.length} 件だめだった`); process.exit(1); }
console.log("\nぜんぶ通った");
