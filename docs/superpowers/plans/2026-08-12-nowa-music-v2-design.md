# Nowa Music v2 デザイン刷新 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公開中の Nowa Music サイト（nowajp.com）の見た目を、ブランド名を主役にした映画的なデザインへ刷新する。機能は一切変えない。

**Architecture:** 既存の Astro サイトを `v2-design` ブランチ上で改修する。`src/styles/theme.css` に欧文表示書体とヘッダー用の変数、共通の見出し型を追加し、各コンポーネント・ページはそのトークンを参照するだけにする。データ層（`catalog.js`・`fetch-youtube.mjs`）とプレイヤー（`Player.astro`）には触らない。

**Tech Stack:** Astro 5 / Noto Serif JP + Cormorant Garamond（Google Fonts）/ 既存の29テスト（`node --test`）

**設計書:** `docs/superpowers/specs/2026-08-12-nowa-music-v2-design.md`

## Global Constraints

- 言語は日本語のみ。UI文言・コメント・コミットメッセージも日本語で書く
- **色は `src/styles/theme.css` の CSS変数のみ**。色リテラル（`#...` / `rgba(...)`）をコンポーネントに直書きしない。新しい色が要るときは `:root` に変数を追加してから参照する
- 配色そのものは変更しない（`--bg-deep` `--text` `--accent` `--line` の値を書き換えない）
- 外部依存を追加しない（npm パッケージを増やさない）。書体は Google Fonts の `<link>` のみ
- 動きは fade in / fade up まで。`prefers-reduced-motion` の尊重を維持する
- スマホ優先。**375px で横スクロールを発生させない**
- 既存の29テストを維持する（`npm test`）
- `src/lib/catalog.js`・`src/lib/embed.js`・`scripts/fetch-youtube.mjs`・`src/components/Player.astro`・`src/data/youtube.json`・`.github/workflows/` は変更しない
- `data-play="<kind>:<id>"` と `data-title` の HTML契約を壊さない（壊すと全ページで再生が無音で死ぬ）
- 作業は `v2-design` ブランチで行い、`main` へは最後にオーナー承認を得てから統合する

---

## ファイル構成

| ファイル | このタスクでの役割 |
|---|---|
| `src/styles/theme.css` | 書体・ヘッダー高さ・半透明背景の変数、共通の見出し型、`scroll-margin-top` |
| `src/layouts/BaseLayout.astro` | Google Fonts の読み込みに Cormorant Garamond を追加 |
| `src/components/Header.astro` | 2段ロゴ・LISTENボタン・固定ヘッダー・罫線 |
| `src/components/AlbumShelf.astro` | カードの列数・枠・公開年 |
| `src/pages/index.astro` | ヒーロー全面刷新、下部セクションの見出し型と「聴けるところ」 |
| `src/pages/music.astro` | ページ見出しの型 |
| `src/pages/about.astro` | ページ見出しの型、プロフィール情報の罫線化 |

`src/components/Footer.astro`・`Player.astro`・`TrackList.astro`・`src/lib/`・`scripts/` は変更しない。

---

## Task 1: ブランチ作成とデザイントークン

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Produces: CSS変数 `--font-display` `--header-bg` `--header-height`
- Produces: 共通クラス `.section__head`（ラベル＋罫線＋見出しの3点セットの器）、`.page__title`（ページ見出し用の大きいサイズ）
- Produces: `section[id]` への `scroll-margin-top`
- 以降の全タスクがこれらを参照する

- [ ] **Step 1: 作業ブランチを作る**

Run:

```bash
cd /c/Users/shoji/nowa-music
git checkout -b v2-design
git status
```

Expected: `On branch v2-design` と表示され、変更なしの状態。

- [ ] **Step 2: theme.css に変数を追加する**

`:root` の `--bg-glow` の次の行（`--font-serif` の直前）に3行を挿入する:

```css
  --font-display: "Cormorant Garamond", "Times New Roman", serif;
  --header-bg: rgba(7, 13, 28, 0.72);
  --header-height: 4.25rem;
```

- [ ] **Step 3: PC幅でヘッダーを少し高くする**

`theme.css` の `:root { ... }` ブロックの直後に追加する:

```css
@media (min-width: 48rem) {
  :root { --header-height: 5rem; }
}
```

- [ ] **Step 4: 見出しの型を作る**

`theme.css` の `.section__label` と `.section__title` を、以下で**置き換える**:

```css
/* ラベル → 罫線 → 大きな和文見出し、の3点セット */
.section__head { margin: 0 0 3rem; }

.section__label {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 1.1rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--line);
}

.section__title {
  font-size: clamp(1.5rem, 5vw, 2.4rem);
  font-weight: 200;
  line-height: 1.6;
  margin: 0 0 2.5rem;
}

.section__head .section__title { margin: 0; }

/* ページ冒頭の見出しはさらに大きく */
.page__title {
  font-size: clamp(2rem, 6vw, 3.5rem);
  line-height: 1.4;
}
```

- [ ] **Step 5: 固定ヘッダーに隠れないようにする**

`theme.css` の `.section { ... }` の直後に追加する:

```css
/* 固定ヘッダーの下にアンカーの着地点が潜らないようにする */
section[id] { scroll-margin-top: calc(var(--header-height) + 1rem); }
```

- [ ] **Step 5b: 3ページに重複しているパーツを共通化する**

`.listen`（配信リンク一覧）は `index.astro` と `about.astro` に、`.more`（「もっと見る」リンク）は `index.astro` と `music.astro` に、同じ内容が別々に書かれている。v2 では見た目を変えるため、ここで `theme.css` に一本化する。

`theme.css` の末尾（`@media (prefers-reduced-motion: reduce)` ブロックの前）に追加する:

```css
/* 「もっと見る」系のリンク。index と music で共用 */
.more { margin-top: 2.5rem; font-size: 0.78rem; letter-spacing: 0.18em; }
.more a { color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 0.2rem; }

/* 配信リンクの一覧。index と about で共用 */
.listen {
  list-style: none;
  padding: 0;
  margin: 0;
  max-width: 34rem;
  border-top: 1px solid var(--line);
}
.listen li { border-bottom: 1px solid var(--line); }
.listen a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 0.25rem;
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.16em;
  transition: color 0.4s ease;
}
.listen a:hover,
.listen a:focus-visible { color: var(--accent); }
.listen__arrow { font-size: 0.8em; color: var(--text-dim); }
```

各ページに残っている `.listen` / `.more` の重複定義は Task 5・Task 6 で削除する。

- [ ] **Step 6: 欧文書体を読み込む**

`src/layouts/BaseLayout.astro` の Google Fonts の `<link>` の `href` を、以下に置き換える（1行）:

```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Noto+Serif+JP:wght@200;300;400&display=swap
```

- [ ] **Step 7: ビルドとテストを確認する**

Run:

```bash
npm test
npm run build
```

Expected: テスト29件すべてパス。ビルドは警告なく成功し、3ページ生成。

Run:

```bash
grep -o 'Cormorant+Garamond[^"]*' dist/index.html
grep -o '\-\-font-display:[^;]*' dist/index.html
```

Expected: 1つ目は書体URLの一部、2つ目は `--font-display: "Cormorant Garamond"...` が出る。**どちらかが空なら先へ進まない**（変数が生成CSSに入っていないと以降の全タスクが無効化される）。

- [ ] **Step 8: コミット**

```bash
git add src/styles/theme.css src/layouts/BaseLayout.astro
git commit -m "feat: 欧文表示書体と見出しの型を追加"
```

---

## Task 2: ヘッダー

**Files:**
- Modify: `src/components/Header.astro`（全面書き換え）

**Interfaces:**
- Consumes: Task 1 の `--font-display` `--header-bg` `--header-height`
- Produces: 高さ `--header-height` の固定ヘッダー。以降のページはこの高さぶんの余白を前提にする
- Produces: `LISTEN` リンク（遷移先 `/#listen`）

- [ ] **Step 1: Header.astro を書き換える**

ファイル全体を以下に置き換える:

```astro
---
const path = Astro.url.pathname;
const items = [
  { href: '/music/', label: 'MUSIC' },
  { href: '/about/', label: 'ABOUT' },
];
---

<header class="header">
  <div class="container header__inner">
    <a class="header__logo" href="/">
      <span class="header__logo-main">NOWA</span>
      <span class="header__logo-sub">MUSIC</span>
    </a>
    <nav class="header__nav" aria-label="メインメニュー">
      {items.map((item) => (
        <a
          class="header__link"
          href={item.href}
          aria-current={path.startsWith(item.href) ? 'page' : undefined}
        >
          {item.label}
        </a>
      ))}
      <a class="header__listen" href="/#listen">
        LISTEN<span class="header__arrow" aria-hidden="true">↗</span>
      </a>
    </nav>
  </div>
</header>

<style>
  .header {
    position: fixed;
    inset: 0 0 auto;
    z-index: 20;
    height: var(--header-height);
    display: flex;
    align-items: center;
    background: var(--header-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .header__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .header__logo {
    display: block;
    line-height: 1.15;
  }
  .header__logo-main {
    display: block;
    font-family: var(--font-display);
    font-size: 1.15rem;
    letter-spacing: 0.3em;
  }
  .header__logo-sub {
    display: block;
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.4em;
    color: var(--text-dim);
  }
  .header__nav {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.24em;
    color: var(--text-dim);
  }
  .header__link:hover,
  .header__link[aria-current='page'] { color: var(--accent); }
  .header__listen {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--line);
    color: var(--text);
    transition: border-color 0.4s ease, color 0.4s ease;
  }
  .header__listen:hover { border-color: var(--accent); color: var(--accent); }
  .header__arrow { font-size: 0.7em; }

  /* スマホではLISTENの文字が詰まるので余白と字間を詰める */
  @media (max-width: 26rem) {
    .header__nav { gap: 0.85rem; font-size: 0.7rem; letter-spacing: 0.16em; }
    .header__listen { padding: 0.45rem 0.7rem; }
  }
</style>
```

- [ ] **Step 2: ビルドして生成HTMLを確認する**

Run:

```bash
npm run build
grep -o 'header__logo-sub[^<]*<[^<]*' dist/index.html | head -1
grep -o 'href="/#listen"' dist/music/index.html
grep -o 'aria-current="page"' dist/music/index.html
```

Expected: 1つ目に `MUSIC`（2段ロゴの下段）、2つ目に `href="/#listen"`、3つ目に `aria-current="page"` が出る。

- [ ] **Step 3: ヘッダーに隠れていないか確かめる**

固定ヘッダーにしたため、`/music`・`/about` の冒頭がヘッダーの下に潜っていないかを数値で確認する。

Run:

```bash
grep -o 'class="section head"' dist/music/index.html
grep -o 'padding-top:9rem' dist/music/index.html
```

Expected: 両方とも出る。`9rem`（144px）はPC時のヘッダー `5rem`（80px）より大きいので重ならない。**もし出ない場合は報告すること**（クラス名が変わっている可能性がある）。

- [ ] **Step 4: テストとコミット**

```bash
npm test
git add src/components/Header.astro
git commit -m "feat: ヘッダーを2段ロゴと固定表示に刷新"
```

---

## Task 3: ヒーロー

**Files:**
- Modify: `src/pages/index.astro`（ヒーロー部分のマークアップとCSS。下部セクションは Task 5 で扱うので触らない）

**Interfaces:**
- Consumes: Task 1 の `--font-display`、既存の `heroStyle`・`tonight`・`tonightPlay`（frontmatter は変更しない）
- Produces: `#hero-clock` 要素（時刻を埋めるスクリプトの対象）

**注意:** frontmatter（`---` に挟まれた部分）は**一切変更しない**。画像の最適化・アルバム取得・`tonightPlay` の組み立てはすでに動いている。

- [ ] **Step 1: ヒーローのマークアップを差し替える**

`<section class="hero">` から `</section>` までを、以下に置き換える:

```astro
    <section class="hero">
      <div class="hero__art" style={heroStyle}></div>
      <div class="container hero__body">
        <p class="hero__label">A J-POP BALLAD PROJECT</p>
        <h1 class="hero__brand">NOWA MUSIC</h1>
        <p class="hero__copy">眠れない夜に、<br />ひとつの恋の物語を。</p>
        {tonight && (
          <button class="hero__play" type="button" data-play={tonightPlay} data-title={tonight.title}>
            <span>今夜の1枚を聴く</span>
            <span class="hero__play-arrow" aria-hidden="true">→</span>
          </button>
        )}
      </div>
      <p class="hero__meta" aria-hidden="true">TOKYO · NIGHT · <time id="hero-clock"></time></p>
      <div class="hero__scroll" aria-hidden="true"><span>SCROLL</span></div>
    </section>
```

- [ ] **Step 2: ヒーローのCSSを差し替える**

`<style>` の中の `.hero` から `.hero__play:hover` までの範囲を、以下に置き換える。`.hero__art` と `@media (min-width: 48rem)` の画像切り替えブロックは**そのまま残すこと**（PC用画像の出し分けが動かなくなる）。

```css
  .hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    align-items: flex-end;
    padding-block: 9rem 7rem;
    overflow: hidden;
  }
  .hero__body { position: relative; }
  .hero__label {
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.36em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 1.75rem;
  }
  .hero__brand {
    font-family: var(--font-display);
    font-size: clamp(2.75rem, 11vw, 8rem);
    font-weight: 300;
    line-height: 1;
    letter-spacing: 0.02em;
    margin: 0 0 1.75rem;
  }
  .hero__copy {
    font-size: clamp(1.05rem, 3.4vw, 1.5rem);
    font-weight: 300;
    line-height: 2;
    margin: 0 0 2.75rem;
  }
  .hero__play {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    min-width: min(16rem, 100%);
    padding: 1rem 1.5rem;
    border: 1px solid var(--line);
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 0.85rem;
    letter-spacing: 0.16em;
    cursor: pointer;
    transition: border-color 0.5s ease, color 0.5s ease;
  }
  .hero__play:hover,
  .hero__play:focus-visible { border-color: var(--accent); color: var(--accent); }
  .hero__play-arrow { transition: transform 0.5s ease; }
  .hero__play:hover .hero__play-arrow { transform: translateX(0.25rem); }

  /* 右端の縦書き。狭い画面では幅を圧迫するので出さない */
  .hero__meta {
    display: none;
    position: absolute;
    right: 1.25rem;
    bottom: 7rem;
    margin: 0;
    writing-mode: vertical-rl;
    font-family: var(--font-display);
    font-size: 0.7rem;
    letter-spacing: 0.3em;
    color: var(--text-dim);
  }
  @media (min-width: 48rem) {
    .hero__meta { display: block; }
  }

  .hero__scroll {
    position: absolute;
    left: 50%;
    bottom: 2rem;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.3em;
    color: var(--text-dim);
  }
  .hero__scroll::after {
    content: "";
    width: 1px;
    height: 3rem;
    background: var(--line);
    animation: scroll-hint 2.8s ease-in-out infinite;
  }
  @keyframes scroll-hint {
    0%, 100% { opacity: 0.3; transform: scaleY(0.6); transform-origin: top; }
    50% { opacity: 1; transform: scaleY(1); transform-origin: top; }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero__scroll::after { animation: none; opacity: 0.6; }
  }
```

- [ ] **Step 3: 時計のスクリプトを足す**

`index.astro` の一番下（`</style>` の後）に追加する:

```astro
<script>
  // 右端の縦書きに閲覧者の現在時刻を出す。JSが動かない環境では時刻だけ出ない。
  const clock = document.getElementById('hero-clock');
  if (clock) {
    const render = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      clock.textContent = `${hh}:${mm}`;
      clock.setAttribute('datetime', `${hh}:${mm}`);
    };
    render();
    setInterval(render, 30000);
  }
</script>
```

- [ ] **Step 4: ビルドして確認する**

Run:

```bash
npm run build
grep -o 'A J-POP BALLAD PROJECT' dist/index.html
grep -o '<h1 class="hero__brand"[^>]*>NOWA MUSIC' dist/index.html
grep -o 'id="hero-clock"' dist/index.html
grep -o '今夜の1枚を聴く' dist/index.html
grep -o 'data-play="[a-z]*:[A-Za-z0-9_-]*"' dist/index.html | head -1
```

Expected: すべて1件以上出る。最後の `data-play` が出ることが**特に重要**（再生ボタンの契約が生きている証拠）。

Run:

```bash
grep -c 'hero-image-desktop' dist/index.html
```

Expected: `1` 以上。PC用画像の出し分けが残っていること。

- [ ] **Step 5: テストとコミット**

```bash
npm test
git add src/pages/index.astro
git commit -m "feat: ヒーローをブランド名主役の構成に刷新"
```

---

## Task 4: アルバムカード

**Files:**
- Modify: `src/components/AlbumShelf.astro`

**Interfaces:**
- Consumes: `Album = { id, kind, title, thumbnail, publishedAt, itemCount }`（`src/lib/catalog.js` が返す形。変更しない）
- Produces: 変更後も `data-play={`${album.kind}:${album.id}`}` と `data-title` を出力し続ける（`Player.astro` との契約）

- [ ] **Step 1: frontmatter で表示用のメタ文字列を作る**

`---` に挟まれた部分を、以下に置き換える:

```astro
---
const { albums = [], limit } = Astro.props;
const source = typeof limit === 'number' ? albums.slice(0, limit) : albums;

// 「2026 · 12曲」のような1行を作る。公開日が壊れていれば年を出さない。
const items = source.map((album) => {
  const year = new Date(album.publishedAt).getFullYear();
  const parts = [
    Number.isNaN(year) ? null : String(year),
    album.itemCount > 0 ? `${album.itemCount}曲` : null,
  ].filter(Boolean);
  return { ...album, meta: parts.join(' · ') };
});
---
```

- [ ] **Step 2: メタの表示を差し替える**

マークアップ内の次の行:

```astro
      {album.itemCount > 0 && <span class="album__meta">{album.itemCount}曲</span>}
```

を、以下に置き換える:

```astro
      {album.meta && <span class="album__meta">{album.meta}</span>}
```

- [ ] **Step 3: 列数と文字を調整する**

`<style>` 内の `.shelf` を以下に置き換える:

```css
  .shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 2.5rem 1.75rem;
  }
  /* 広い画面では3列にして1枚を大きく見せる */
  @media (min-width: 64rem) {
    .shelf { grid-template-columns: repeat(3, 1fr); }
  }
```

同じ `<style>` 内の `.album__title` の `font-size` を `0.9rem` から `0.95rem` に変更する。

同じ `<style>` 内の `.album__meta` に、欧文書体と字間を与える。以下に置き換える:

```css
  .album__meta {
    display: block;
    margin-top: 0.4rem;
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    color: var(--text-dim);
  }
```

- [ ] **Step 4: ビルドして確認する**

Run:

```bash
npm run build
grep -o 'class="album__meta"[^<]*<*[^<]*' dist/index.html | head -3
grep -o 'data-play="[a-z]*:[A-Za-z0-9_-]*"' dist/index.html | wc -l
grep -o 'class="album"' dist/music/index.html | wc -l
```

Expected: 1つ目に `2026 · 2曲` のような文字列。2つ目は 9（トップのアルバム8件＋ヒーローのCTA1件）。3つ目は 55。**数が違ったら報告すること**。

- [ ] **Step 5: テストとコミット**

```bash
npm test
git add src/components/AlbumShelf.astro
git commit -m "feat: アルバムカードを3列と公開年つきに変更"
```

---

## Task 5: トップの下部セクション

**Files:**
- Modify: `src/pages/index.astro`（ヒーローより下の部分と、対応するCSS）

**Interfaces:**
- Consumes: Task 1 の `.section__head` `.section__label` `.section__title`
- Produces: `#albums` `#about` `#listen` の各セクション（idは変更しない。ヘッダーの LISTEN が `#listen` に着地する）

- [ ] **Step 1: 世界観セクションの文字を大きくする**

`<style>` 内の `.words p` を以下に置き換える:

```css
  .words p {
    font-size: clamp(1.1rem, 4vw, 1.5rem);
    line-height: 2.6;
    margin: 0 0 2rem;
  }
```

同じく `.words` を以下に置き換える（前後の余白を広げる）:

```css
  .words { text-align: center; padding-block: clamp(6rem, 16vw, 11rem); }
```

- [ ] **Step 2: 3つのセクション見出しを新しい型に包む**

ALBUM セクションの中の次の2行:

```astro
          <p class="section__label">ALBUM</p>
          <h2 class="section__title">眠りにつくまでの時間に、そっと。</h2>
```

を、以下に置き換える:

```astro
          <div class="section__head">
            <p class="section__label">ALBUM</p>
            <h2 class="section__title">眠りにつくまでの時間に、そっと。</h2>
          </div>
```

ABOUT セクションの中の次の2行:

```astro
        <p class="section__label">ABOUT</p>
        <h2 class="section__title">Nowa について</h2>
```

を、以下に置き換える:

```astro
        <div class="section__head">
          <p class="section__label">ABOUT</p>
          <h2 class="section__title">Nowa について</h2>
        </div>
```

LISTEN セクションの中の次の2行:

```astro
          <p class="section__label">LISTEN</p>
          <h2 class="section__title">聴けるところ</h2>
```

を、以下に置き換える:

```astro
          <div class="section__head">
            <p class="section__label">LISTEN</p>
            <h2 class="section__title">聴けるところ</h2>
          </div>
```

- [ ] **Step 3: 「聴けるところ」を罫線の一覧に変える**

`<ul class="listen">` のブロック全体を、以下に置き換える:

```astro
          <ul class="listen">
            {links.map((link) => (
              <li>
                <a href={link.url} target="_blank" rel="noopener">
                  <span>{link.label}</span>
                  <span class="listen__arrow" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
```

- [ ] **Step 4: ページ内の重複CSSを削除する**

`.listen` と `.more` は Task 1 で `theme.css` に移した。`index.astro` の `<style>` から、次の**5行を削除する**（重複したままだと、後で片方だけ直して食い違う）:

```css
  .more { margin-top: 2.5rem; font-size: 0.78rem; letter-spacing: 0.18em; }
  .more a { color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 0.2rem; }
```

```css
  .listen {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 2.5rem;
    font-size: 0.85rem;
    letter-spacing: 0.16em;
  }
  .listen a { border-bottom: 1px solid var(--line); padding-bottom: 0.25rem; }
  .listen a:hover { color: var(--accent); }
```

`.about p { max-width: 34rem; }` と `.words` 系は**残すこと**（このページ固有のため）。

- [ ] **Step 5: ビルドして確認する**

Run:

```bash
npm run build
grep -o 'class="section__head"' dist/index.html | wc -l
grep -o 'class="listen__arrow"' dist/index.html | wc -l
grep -o 'id="listen"' dist/index.html
```

Expected: 1つ目は 3、2つ目は 5（外部リンク5件）、3つ目は `id="listen"` が出る。

- [ ] **Step 6: テストとコミット**

```bash
npm test
git add src/pages/index.astro
git commit -m "feat: トップ下部の見出しと聴けるところを刷新"
```

---

## Task 6: MUSIC と ABOUT

**Files:**
- Modify: `src/pages/music.astro`
- Modify: `src/pages/about.astro`

**Interfaces:**
- Consumes: Task 1 の `.section__head` `.page__title`、共通化した `.listen` `.more`

**現状（確認済み）:**
- `music.astro` の h1 は「夜が終わるまで、流していられる歌。」（「夜のための、アルバム。」ではない。前回のコピー刷新で変わっている）
- `music.astro` の ALBUM 見出しは `<h2 class="section__title">ALBUM</h2>` で、ラベルが無い
- `about.astro` のプロフィール情報はすでに `.facts__row` で罫線区切りになっている。**設計書の要求を満たしているので変更しない**
- `about.astro` の LISTEN は `section__label` のみで見出しが無い

- [ ] **Step 1: MUSIC のページ見出しを新しい型にする**

`src/pages/music.astro` の次の2行:

```astro
        <p class="section__label">MUSIC</p>
        <h1 class="section__title">夜が終わるまで、流していられる歌。</h1>
```

を、以下に置き換える:

```astro
        <div class="section__head">
          <p class="section__label">MUSIC</p>
          <h1 class="section__title page__title">夜が終わるまで、流していられる歌。</h1>
        </div>
```

- [ ] **Step 2: MUSIC の ALBUM 見出しをラベル型にする**

`ALBUM` は欧文1語なので、大きな和文見出しではなくラベル＋罫線として扱う。次の1行:

```astro
          <h2 class="section__title">ALBUM</h2>
```

を、以下に置き換える:

```astro
          <div class="section__head">
            <h2 class="section__label">ALBUM</h2>
          </div>
```

- [ ] **Step 3: MUSIC の重複CSSを削除する**

`src/pages/music.astro` の `<style>` から、次の2行を削除する（Task 1 で `theme.css` に移した）:

```css
  .more { margin-top: 2.5rem; font-size: 0.78rem; letter-spacing: 0.18em; }
  .more a { color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 0.2rem; }
```

`.head { padding-top: 9rem; }` は**残すこと**（固定ヘッダーを避ける余白）。

- [ ] **Step 4: ABOUT のページ見出しを新しい型にする**

`src/pages/about.astro` の次の2行:

```astro
        <p class="section__label">ABOUT</p>
        <h1 class="section__title">Nowa</h1>
```

を、以下に置き換える:

```astro
        <div class="section__head">
          <p class="section__label">ABOUT</p>
          <h1 class="section__title page__title">Nowa</h1>
        </div>
```

- [ ] **Step 5: ABOUT の配信リンクをトップと同じ体裁にする**

次のブロック:

```astro
          <p class="section__label">LISTEN</p>
          <ul class="listen">
            {links.map((link) => (
              <li><a href={link.url} target="_blank" rel="noopener">{link.label}</a></li>
            ))}
          </ul>
```

を、以下に置き換える:

```astro
          <div class="section__head">
            <p class="section__label">LISTEN</p>
          </div>
          <ul class="listen">
            {links.map((link) => (
              <li>
                <a href={link.url} target="_blank" rel="noopener">
                  <span>{link.label}</span>
                  <span class="listen__arrow" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
```

- [ ] **Step 6: ABOUT の重複CSSを削除する**

`src/pages/about.astro` の `<style>` から、`.listen` の3つのルール（`.listen { ... }`、`.listen a { ... }`、`.listen a:hover { ... }`）を削除する。`theme.css` の定義が効く。

`.facts` 系のルールと `.profile` 系、`.head { padding-top: 9rem; }` は**すべて残すこと**。

- [ ] **Step 7: ビルドして確認する**

Run:

```bash
npm run build
echo "--- 見出しの型 ---"
grep -o 'class="section__head"' dist/music/index.html | wc -l
grep -o 'class="section__head"' dist/about/index.html | wc -l
grep -o 'page__title' dist/music/index.html | wc -l
grep -o 'page__title' dist/about/index.html | wc -l
echo "--- 消えていないもの ---"
grep -o 'class="facts"' dist/about/index.html
grep -o 'もっと聴く' dist/music/index.html
grep -o 'class="album"' dist/music/index.html | wc -l
grep -o 'class="listen__arrow"' dist/about/index.html | wc -l
```

Expected: `section__head` は music が 2、about が 2。`page__title` は各1件。`facts`・「もっと聴く」が残り、アルバムは55件、about の矢印は5件。

- [ ] **Step 8: テストとコミット**

```bash
npm test
git add src/pages/music.astro src/pages/about.astro
git commit -m "feat: MUSICとABOUTに新しい見出しの型を適用"
```

---

## Task 7: 全画面幅の検証と統合

**Files:** 変更なし（検証のみ。修正が必要なら該当ファイルを直す）

このタスクの**スクリーンショット確認はコントローラー（オーナーと対話している側）が行う**。実装担当は Step 1〜3 までを行い、結果を報告して止まること。

- [ ] **Step 1: 最終ビルドとテスト**

Run:

```bash
npm test
npm run build
```

Expected: 29件パス、ビルド警告なし、3ページ生成。

- [ ] **Step 2: 生成物の総点検**

Run:

```bash
echo "--- 再生ボタンの契約 ---"
grep -o 'data-play="[a-z]*:[A-Za-z0-9_-]*"' dist/index.html | wc -l
grep -o 'data-play="[a-z]*:[A-Za-z0-9_-]*"' dist/music/index.html | wc -l
echo "--- アンカー ---"
grep -o 'id="listen"' dist/index.html
grep -o 'href="/#listen"' dist/about/index.html
echo "--- 色の直書きが混入していないか ---"
grep -oE '(#[0-9a-fA-F]{3,6}|rgba?\()' dist/index.html | sort | uniq -c
```

Expected:
- 1つ目は 9、2つ目は 55
- `id="listen"` と `href="/#listen"` が出る
- 最後の色の一覧に、`theme.css` の `:root` で定義した値以外の**新しい色が増えていないこと**。`#070d1c`（theme-color の例外）は出てよい。それ以外の見慣れない色があれば、どのファイルで直書きしたかを特定して変数に直すこと

- [ ] **Step 3: 報告して止まる**

変更したファイル一覧、上記の確認結果、気づいた点をレポートに書き、**コントローラーのスクリーンショット確認を待つ**。ここで `main` へのマージや `git push` を**行わないこと**。

- [ ] **Step 4: コントローラーによる画面確認**

コントローラーが以下を行う。

```bash
npx astro preview --port 4321   # バックグラウンドで起動
```

375 / 768 / 1280 / 1920px の4幅でトップ・MUSIC・ABOUTを開き、次を確認する:

- 横スクロールが発生しない（`document.body.scrollWidth <= window.innerWidth`）
- ヒーローのブランド名が画面からはみ出さない
- 縦書きの時刻が 768px 以上で表示され、375px で消えている
- 固定ヘッダーが `/music`・`/about` の冒頭見出しに重なっていない
- アルバムをクリックするとプレイヤーが開き、Escape で閉じて音が止まる
- ヘッダーの LISTEN からトップの「聴けるところ」に着地する

スクリーンショットをオーナーに提示し、承認を得る。

- [ ] **Step 5: main へ統合して公開**

オーナーの承認後、コントローラーが実行する。

```bash
git checkout main
git merge --no-ff v2-design -m "feat: サイト全体のデザインをv2へ刷新"
git push origin main
gh run watch $(gh run list -R SHO1969/nowa_music --limit 1 --json databaseId -q '.[0].databaseId') -R SHO1969/nowa_music --exit-status
curl -sI https://nowajp.com | head -2
```

Expected: デプロイ成功、`HTTP/1.1 200 OK`。

承認が得られなければ `v2-design` ブランチを残したまま止める。`main` は無傷なので公開中のサイトは影響を受けない。

---

## 完了の定義

- [ ] `npm test` が29件パスする
- [ ] 375 / 768 / 1280 / 1920px の4幅で、3ページとも横スクロールが出ない
- [ ] アルバムのクリックで再生でき、Escape で音が止まる
- [ ] ヘッダーの LISTEN が「聴けるところ」に着地する
- [ ] 色リテラルがコンポーネントに増えていない
- [ ] オーナーの承認を得たうえで `main` に統合され、`https://nowajp.com` が更新されている

## 今回やらないこと

- STORIES（恋物語）と STORY DETAIL ページ
- 感情セレクター「今夜はどんな気持ちですか？」
- PLAYLISTS の独立セクション
- Next.js / Vercel への移行
- ハンバーガーメニュー（ナビが2項目のため不要）
- `catalog.js`・`fetch-youtube.mjs`・`Player.astro`・ワークフローへの変更
