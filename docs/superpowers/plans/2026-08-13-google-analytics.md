# Googleアナリティクス（GA4）導入 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公開中の nowajp.com にGA4の計測タグを組み込み、ページの閲覧状況を把握できるようにする。

**Architecture:** 測定IDを `src/lib/analytics.js` の1箇所に集め、`BaseLayout.astro` がそこから読んで計測タグを出力する。出力するのは「IDが空でない」かつ「本番ビルド」のときだけ。告知はフッターに一文添える。既存の `src/lib/links.js`（URLが空なら表示しない）と同じ考え方に揃える。

**Tech Stack:** Astro 5 / Google Analytics 4（gtag.js）/ 既存の29テスト（`node --test`）

**設計書:** `docs/superpowers/specs/2026-08-13-google-analytics-design.md`

## Global Constraints

- 言語は日本語のみ。UI文言・コメント・コミットメッセージも日本語で書く
- 色は `src/styles/theme.css` の CSS変数のみ。色リテラル（`#...` / `rgba(...)`）を直書きしない
- 外部依存を追加しない（npmパッケージを増やさない）
- 既存の29テストを維持する（`npm test`）
- スマホ優先。**375px で横スクロールを発生させない**
- `src/lib/catalog.js`・`src/lib/embed.js`・`src/lib/links.js`・`scripts/`・`src/components/Player.astro`・`src/data/youtube.json`・`.github/workflows/` は変更しない
- `data-play="<kind>:<id>"` と `data-title` の HTML契約を壊さない
- 測定IDは `G-1TMW24TDHY`。**これは秘密情報ではない**ため、リポジトリに直接記載してよい（`.env` や GitHub Secrets では扱わない）
- **`npm run dev` を実行しないこと**（サーバーが終了しない）。確認は `npm run build` と生成物の grep、必要なら `npx astro preview` で行う

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/lib/analytics.js`（新規） | 測定IDの定数と、計測タグを出すべきかの判定 |
| `src/layouts/BaseLayout.astro` | `<head>` に計測タグを条件付きで出力 |
| `src/components/Footer.astro` | 利用告知の一文 |

---

## Task 1: 計測タグの組み込み

**Files:**
- Create: `src/lib/analytics.js`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Produces: `MEASUREMENT_ID`（文字列。空文字なら計測を止める）
- Produces: `isAnalyticsEnabled(isProduction: boolean): boolean` — 計測タグを出力すべきかの判定

- [ ] **Step 1: analytics.js を作る**

`src/lib/analytics.js` を新規作成する:

```js
/**
 * Googleアナリティクス（GA4）の設定。
 * 測定IDはブラウザ側のコードに必ず出るものなので、秘密情報ではない。
 * 計測を止めたいときは MEASUREMENT_ID を空文字にする。
 */
export const MEASUREMENT_ID = 'G-1TMW24TDHY';

/**
 * 計測タグを出力すべきか。
 * 本番ビルドのときだけ出す。ローカルでの確認を数字に混ぜないため。
 */
export function isAnalyticsEnabled(isProduction) {
  return Boolean(MEASUREMENT_ID) && isProduction === true;
}
```

- [ ] **Step 2: BaseLayout の frontmatter で判定する**

`src/layouts/BaseLayout.astro` の frontmatter（`---` に挟まれた部分）の import に1行足す:

```astro
import { MEASUREMENT_ID, isAnalyticsEnabled } from '../lib/analytics.js';
```

同じ frontmatter の末尾（`const fullTitle = ...` の次の行）に1行足す:

```astro
const analyticsEnabled = isAnalyticsEnabled(import.meta.env.PROD);
```

- [ ] **Step 3: 計測タグを head に出力する**

`src/layouts/BaseLayout.astro` の `<head>` の中、**書体を読み込む `<link rel="stylesheet" ...>` の直後・`</head>` の直前**に、以下を挿入する。書体は見た目に直結するため先に読ませ、計測は後追いにする。

```astro
    {analyticsEnabled && (
      <>
        <script async is:inline src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}></script>
        <script is:inline define:vars={{ measurementId: MEASUREMENT_ID }}>
          window.dataLayer = window.dataLayer || [];
          function gtag() { dataLayer.push(arguments); }
          gtag('js', new Date());
          gtag('config', measurementId);
        </script>
      </>
    )}
```

**なぜ `is:inline` が要るか:** Astro は既定で `<script>` をバンドル・最適化し、`<head>` から動かすことがある。GA4のタグは「この位置にこの形で出る」ことが前提なので、Astro に触らせない指定が必要。`define:vars` は測定IDをスクリプトへ渡すためのもので、これも `is:inline` とセットで使う。

- [ ] **Step 4: ビルドして本番出力を確認する**

Run:

```bash
npm run build
echo "--- 3ページに測定IDが入っているか ---"
grep -c 'G-1TMW24TDHY' dist/index.html
grep -c 'G-1TMW24TDHY' dist/music/index.html
grep -c 'G-1TMW24TDHY' dist/about/index.html
echo "--- タグの形 ---"
grep -o 'googletagmanager.com/gtag/js?id=G-1TMW24TDHY' dist/index.html
grep -o "gtag('config', *[\"']G-1TMW24TDHY[\"'])" dist/index.html
```

Expected: 最初の3つは 1 以上。4つ目に読み込みURL、5つ目に `gtag('config', 'G-1TMW24TDHY')` が出る。

**5つ目が出ない場合**は `define:vars` の展開が想定と違う可能性がある。`grep -o "gtag('config'[^)]*)" dist/index.html` で実際の出力を確認し、測定IDが正しく埋まっているなら合格とみなしてよい（引用符の種類は問わない）。実際の出力をレポートに貼ること。

- [ ] **Step 5: 計測を止められることを確認する**

`src/lib/analytics.js` の `MEASUREMENT_ID` を一時的に `''`（空文字）にして:

```bash
npm run build
grep -c 'googletagmanager' dist/index.html || echo "0件（正しく止まっている）"
```

Expected: 0件。確認できたら **`MEASUREMENT_ID` を `'G-1TMW24TDHY'` に戻し、もう一度 `npm run build` して測定IDが戻ったことを確認する**。

- [ ] **Step 6: テストとコミット**

```bash
npm test
git add src/lib/analytics.js src/layouts/BaseLayout.astro
git commit -m "feat: Googleアナリティクスの計測タグを追加"
```

Expected: テスト29件パス。

---

## Task 2: 利用告知と公開

**Files:**
- Modify: `src/components/Footer.astro`

**Interfaces:**
- Consumes: なし（表示のみ）

- [ ] **Step 1: フッターに一文を足す**

`src/components/Footer.astro` の次の行:

```astro
    <p class="footer__copy">© {year} Nowa Music</p>
```

を、以下に置き換える:

```astro
    <p class="footer__note">当サイトではGoogleアナリティクスを使用しています。</p>
    <p class="footer__copy">© {year} Nowa Music</p>
```

- [ ] **Step 2: 告知のCSSを足す**

同じファイルの `<style>` の中、`.footer__copy` の**前**に追加する:

```css
  .footer__note {
    font-size: 0.68rem;
    line-height: 1.9;
    margin: 2rem 0 0;
  }
```

`.footer` が既に `color: var(--text-dim)` を持つため、色の指定は不要（新しい色リテラルを増やさない）。

- [ ] **Step 3: 3ページに出ることと、狭い画面で崩れないことを確認する**

Run:

```bash
npm run build
for p in index music/index about/index; do echo "$p: $(grep -c 'Googleアナリティクスを使用しています' dist/$p.html) 件"; done
```

Expected: 3ページとも 1 件。

続いて実測する。`npx astro preview --port 4321` をバックグラウンドで起動し、ブラウザ操作ツールで `http://localhost:4321/` を **375px** 幅で開いて次を計測する。**`npm run dev` は使わないこと。**

- `document.body.scrollWidth <= window.innerWidth`（横スクロールが無いこと）
- `.footer__note` が表示されており（`display` が `none` でない）、幅がビューポートに収まっていること

確認後はプレビューサーバーを止めること。

- [ ] **Step 4: テストとコミット**

```bash
npm test
git add src/components/Footer.astro
git commit -m "feat: フッターにアクセス解析の利用告知を追加"
```

Expected: テスト29件パス。

- [ ] **Step 5: 公開する**

このステップは**コントローラー（オーナーと対話している側）が実行する**。実装担当は Step 4 まで行って報告し、止まること。

```bash
git push origin main
gh run watch $(gh run list -R SHO1969/nowa_music --limit 1 --json databaseId -q '.[0].databaseId') -R SHO1969/nowa_music --exit-status
curl -s https://nowajp.com/ | grep -o 'G-1TMW24TDHY' | head -1
```

Expected: デプロイ成功、本番のHTMLに測定IDが含まれる。

なお、リモートで日次のデータ更新コミットが入っている場合は `git pull` してから push すること。

- [ ] **Step 6: GA4のリアルタイムで受信を確認する**

オーナーに `https://nowajp.com` をブラウザで開いてもらい、GA4の管理画面 →「レポート」→「リアルタイム」に自分のアクセスが表示されることを確認する。反映まで数十秒かかることがある。

**表示されない場合の切り分け:**
- ブラウザの広告ブロッカー・トラッキング防止機能が計測を遮っている可能性が高い（最も多い原因）。別のブラウザやシークレットウィンドウで試す
- それでも出なければ、本番HTMLに測定IDが入っているか（Step 5 の最後のコマンド）を再確認する

---

## 完了の定義

- [ ] `npm test` が29件パスする
- [ ] 3ページすべてに測定IDが出力されている
- [ ] `MEASUREMENT_ID` を空にすると計測タグが消える
- [ ] フッターの告知が3ページに表示され、375px で崩れない
- [ ] `https://nowajp.com` に測定IDが反映されている
- [ ] GA4のリアルタイム画面にアクセスが表示される

## 今回やらないこと

- クッキー同意バナー
- プライバシーポリシーの独立ページ
- アルバム再生を記録する独自イベント
- 配信リンクのクリックを記録する独自イベント（GA4の拡張計測機能が自動で拾う）
- Partytown 等による計測タグの軽量化
- 自分のアクセスを除外するIPフィルタ
