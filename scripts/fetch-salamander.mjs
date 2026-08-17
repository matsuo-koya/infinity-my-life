/* Salamander Grand Piano V3 の音を public/salamander/ に取り込む。
   30個の標本（短3度おき）で88鍵ぶんを賄う。

   録音・制作 Alexander Holm、CC BY 3.0。
   https://archive.org/details/SalamanderGrandPianoV3
   ここで取るのは Tone.js が配っている mp3 変換版。

   再配布には表示が要る。public/salamander/CREDITS.txt を消さないこと。 */

import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://tonejs.github.io/audio/salamander/";
const DEST = new URL("../public/salamander/", import.meta.url);

/* イ・ハ・嬰ニ・嬰ヘ。短3度おきに録ってある */
const KEYS = [];
for (const oct of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
  for (const n of ["A", "C", "Ds", "Fs"]) {
    if (n === "A" && oct > 7) continue;
    if (n !== "A" && oct === 0) continue;
    if (n !== "C" && oct === 8) continue;
    KEYS.push(`${n}${oct}`);
  }
}

await mkdir(DEST, { recursive: true });
let total = 0;
for (const k of KEYS) {
  const res = await fetch(BASE + k + ".mp3");
  if (!res.ok) { console.warn(`  × ${k} — ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(k + ".mp3", DEST), buf);
  total += buf.length;
  process.stdout.write(`\r  ${k} … ${(total / 1e6).toFixed(2)} MB   `);
}
console.log(`\n${KEYS.length} 個、計 ${(total / 1e6).toFixed(2)} MB を ${DEST.pathname} へ`);
