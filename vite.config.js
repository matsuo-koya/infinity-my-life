import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /* GitHub Pages のプロジェクトページは /<リポジトリ名>/ に置かれる。
     ビルド時に VITE_BASE を渡す（ワークフローがリポジトリ名から自動で入れる） */
  base: process.env.VITE_BASE || "/",
  server: { port: 5175, open: true },
});
