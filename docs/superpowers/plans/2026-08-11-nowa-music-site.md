# Nowa Music 公式サイト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nowa Music の世界観を伝える3ページの静的サイトを作り、YouTubeから日次で自動更新されるようにして `https://nowajp.com` で公開する。

**Architecture:** Astro の静的サイト生成。データは `scripts/fetch-youtube.mjs` が YouTube Data API v3 から取得して `src/data/youtube.json` に保存し、`src/lib/catalog.js` が純粋関数としてアルバム／楽曲に整形する。ページはその結果を表示するだけ。取得（I/O）と整形（ロジック）と表示（UI）を分けているので、API仕様が変わってもページ側は触らない。GitHub Actions が毎朝 取得 → コミット → ビルド → GitHub Pages へデプロイする。

**Tech Stack:** Astro 5 / Node.js 24（`node --test` のみ、テストフレームワーク追加なし）/ GitHub Actions / GitHub Pages / YouTube Data API v3

**設計書:** `docs/superpowers/specs/2026-08-11-nowa-music-site-design.md`

## Global Constraints

- 言語は日本語のみ。`<html lang="ja">`。UI文言・コメント・コミットメッセージも日本語で書く
- 配色は固定: 背景 `#070d1c` → `#101d3c`、文字 `#e8edf7`、アクセント `#9db4e0`
- 書体は明朝体（Noto Serif JP、ウェイト 200/300/400 のみ）
- スマホ優先。基準幅 375px で崩れないことを常に確認する
- アルバムの判定は **20分（1200秒）以上**。楽曲は **60秒以上1200秒未満**（60秒未満はShortsとみなし除外する）
- トップのアルバム棚は最大8件、新着曲は6件、`/music` の楽曲は最新20件
- APIキーは `YOUTUBE_API_KEY` 環境変数からのみ読む。コード・コミットに含めない
- 外部依存は Astro のみ。テスト用・UI用のライブラリを追加しない
- 派手なアニメーションは入れない。動きはフェードインまでとする
- 各タスクの最後に必ずコミットする

---

## ファイル構成

| ファイル | 責務 |
|---|---|
| `astro.config.mjs` | サイトURLなどAstroの設定 |
| `package.json` | 依存とスクリプト（dev / build / fetch / test） |
| `scripts/fetch-youtube.mjs` | YouTube APIを叩き `src/data/youtube.json` を書く。失敗しても既存ファイルを壊さない |
| `scripts/fetch-youtube.test.mjs` | 上のユニットテスト（fetchを差し替えて実行、ネットワーク不要） |
| `src/data/youtube.json` | 取得結果。リポジトリにコミットする（取得失敗時の予備） |
| `src/lib/catalog.js` | JSON → `{albums, tracks}` に整形する純粋関数 |
| `src/lib/catalog.test.mjs` | 上のユニットテスト |
| `src/lib/embed.js` | 動画/再生リストID → 埋め込みURL を作る純粋関数 |
| `src/lib/embed.test.mjs` | 上のユニットテスト |
| `src/styles/theme.css` | 配色・書体・共通の余白 |
| `src/layouts/BaseLayout.astro` | html/head/メタタグ/ヘッダー/フッターの枠 |
| `src/components/Header.astro` | ロゴと MUSIC / ABOUT |
| `src/components/Footer.astro` | SNSリンク、メール、コピーライト |
| `src/components/Player.astro` | 画面全体のプレイヤーモーダル（1ページに1つ） |
| `src/components/AlbumShelf.astro` | アルバムカードの棚 |
| `src/components/TrackList.astro` | 楽曲リスト |
| `src/pages/index.astro` | トップ |
| `src/pages/music.astro` | アルバム全部＋最新20曲 |
| `src/pages/about.astro` | Nowaについて |
| `public/CNAME` | `nowajp.com` |
| `.github/workflows/deploy.yml` | 日次取得・ビルド・デプロイ |

---

## Task 1: 準備（APIキーとチャンネルIDの確定）

**これは人間（サイトのオーナー）の作業です。** 以降のタスクはすべてこれに依存します。

**Files:**
- Create: `.env`（ローカル用。`.gitignore` 済みなのでコミットされない）

**Interfaces:**
- Produces: 環境変数 `YOUTUBE_API_KEY`、確定した `CHANNEL_ID`（`UC` で始まる24文字）

- [ ] **Step 1: Google Cloud で APIキーを作る**

1. https://console.cloud.google.com/ を開く（Googleアカウントでログイン）
2. 画面上部のプロジェクト選択 → 「新しいプロジェクト」→ 名前を `nowa-music-site` にして作成
3. 左メニュー「APIとサービス」→「ライブラリ」→ `YouTube Data API v3` を検索して開く →「有効にする」
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」
5. 表示された文字列（`AIza...`）をコピー
6. そのキーの「キーを制限」→ API の制限 →「YouTube Data API v3」だけにチェックして保存

- [ ] **Step 2: ローカルに `.env` を作る**

`C:\Users\shoji\nowa-music\.env` を作り、1行だけ書く（`AIza...` は実際のキーに置き換える）:

```
YOUTUBE_API_KEY=AIza...
```

- [ ] **Step 3: キーが有効か確認し、チャンネルIDを取得する**

Run:

```bash
curl -s "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=@nowa_music_jp&key=$YOUTUBE_API_KEY"
```

Expected: `"title": "Nowa Music"` と `"id": "UC..."` を含むJSONが返る。

`"error"` が返る場合:
- `API key not valid` → キーのコピーミス。Step 1-5 をやり直す
- `has not been used in project` → Step 1-3 の有効化ができていない
- `items: []` → ハンドル名の綴り違い。ブラウザで `https://www.youtube.com/@nowa_music_jp` を開いて確認する

- [ ] **Step 4: チャンネルIDを控える**

返ってきた `id`（`UC` で始まる文字列）をメモする。Task 4 のテストと `.env` で使う。`.env` に追記:

```
YOUTUBE_CHANNEL_ID=UC...
```

- [ ] **Step 5: GitHubリポジトリを作り、Secretsに登録する**

Run（`<ユーザー名>` は自分のGitHubユーザー名）:

```bash
cd /c/Users/shoji/nowa-music
gh repo create nowa-music --public --source=. --remote=origin
gh secret set YOUTUBE_API_KEY
gh secret set YOUTUBE_CHANNEL_ID
```

（`gh secret set` は値の入力を求めるので、キーを貼り付けてEnter）

Expected: `gh secret list` に `YOUTUBE_API_KEY` と `YOUTUBE_CHANNEL_ID` が並ぶ。

- [ ] **Step 6: ここまでをコミット**

```bash
git add .gitignore
git commit -m "chore: .envを除外設定に追加"
```

---

## Task 2: Astro の土台とテーマ

**Files:**
- Create: `package.json`, `astro.config.mjs`, `src/styles/theme.css`, `src/layouts/BaseLayout.astro`, `src/pages/index.astro`, `public/CNAME`

**Interfaces:**
- Produces: `BaseLayout.astro`（props: `title: string`, `description?: string`）。以降の全ページがこれを使う
- Produces: CSS変数 `--bg-deep --bg-mid --bg-far --text --text-dim --accent --line --font-serif`

- [ ] **Step 1: package.json を作り Astro を入れる**

Run:

```bash
cd /c/Users/shoji/nowa-music
npm init -y
npm install astro@^5
```

- [ ] **Step 2: package.json のスクリプトを書き換える**

`package.json` の `"scripts"` を丸ごと以下に置き換え、`"type": "module"` を追加する:

```json
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "fetch": "node --env-file=.env scripts/fetch-youtube.mjs",
    "test": "node --test"
  },
```

- [ ] **Step 3: astro.config.mjs を作る**

```js
// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://nowajp.com',
});
```

- [ ] **Step 4: src/styles/theme.css を作る**

```css
:root {
  --bg-deep: #070d1c;
  --bg-mid: #0d1730;
  --bg-far: #101d3c;
  --text: #e8edf7;
  --text-dim: rgba(232, 237, 247, 0.62);
  --accent: #9db4e0;
  --line: rgba(157, 180, 224, 0.22);
  --font-serif: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif;
  --page-max: 68rem;
}

*, *::before, *::after { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(157, 180, 224, 0.10), transparent 60%),
    linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-mid) 45%, var(--bg-far) 100%);
  background-attachment: fixed;
  color: var(--text);
  font-family: var(--font-serif);
  font-weight: 300;
  line-height: 1.9;
  letter-spacing: 0.06em;
  -webkit-font-smoothing: antialiased;
}

img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }

.container {
  width: 100%;
  max-width: var(--page-max);
  margin-inline: auto;
  padding-inline: 1.25rem;
}

.section { padding-block: clamp(4rem, 12vw, 8rem); }

.section__label {
  font-size: 0.7rem;
  letter-spacing: 0.34em;
  color: var(--accent);
  margin: 0 0 1.5rem;
}

.section__title {
  font-size: clamp(1.35rem, 4.5vw, 1.9rem);
  font-weight: 200;
  margin: 0 0 2.5rem;
}

/* スクロールでゆっくり浮かび上がる */
.reveal {
  opacity: 0;
  transform: translateY(1.5rem);
  transition: opacity 1.2s ease, transform 1.2s ease;
}
.reveal.is-visible { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

- [ ] **Step 5: src/layouts/BaseLayout.astro を作る**

```astro
---
import '../styles/theme.css';

const {
  title,
  description = '夜にそっと寄り添う、女性ボーカルのJ-POPバラード。眠れない夜、疲れた夜、ひとりで過ごす時間に。',
} = Astro.props;

const fullTitle = title ? `${title} | Nowa Music` : 'Nowa Music';
---

<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta name="theme-color" content="#070d1c" />
    <link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@200;300;400&display=swap"
    />
  </head>
  <body>
    <slot />

    <script>
      // .reveal を画面に入ったら表示する
      const targets = document.querySelectorAll('.reveal');
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          }
        },
        { rootMargin: '0px 0px -12% 0px' }
      );
      targets.forEach((el) => observer.observe(el));
    </script>
  </body>
</html>
```

- [ ] **Step 6: 仮のトップページを作る**

`src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout>
  <main class="container section">
    <p class="section__label">NOWA MUSIC</p>
    <h1 class="section__title">夜が、ひとりをやさしくする。</h1>
  </main>
</BaseLayout>
```

- [ ] **Step 7: public/CNAME を作る**

中身は1行だけ:

```
nowajp.com
```

- [ ] **Step 8: ビルドが通ることを確認する**

Run: `npm run build`
Expected: エラーなく終了し、`dist/index.html` と `dist/CNAME` が生成される。

Run: `npm run dev` してブラウザで `http://localhost:4321` を開く
Expected: 濃紺の背景に明朝体で「夜が、ひとりをやさしくする。」が表示される。確認したら Ctrl+C で止める。

- [ ] **Step 9: コミット**

```bash
git add package.json package-lock.json astro.config.mjs src public
git commit -m "feat: Astroの土台と月光テーマを追加"
```

---

## Task 3: カタログ整形ロジック（純粋関数）

YouTubeから取ったデータを、アルバムと楽曲に振り分ける部分。ネットワークもファイルも触らないので、ここを先にテストで固める。

**Files:**
- Create: `src/lib/catalog.js`
- Test: `src/lib/catalog.test.mjs`

**Interfaces:**
- Consumes: `src/data/youtube.json` の形（`{ channelId: string, videos: Video[], playlists: Playlist[] }`）
  - `Video = { id: string, title: string, description: string, thumbnail: string, publishedAt: string, duration: string }`（`duration` はISO8601、例 `PT4M13S`）
  - `Playlist = { id: string, title: string, description: string, thumbnail: string, publishedAt: string, itemCount: number }`
- Produces:
  - `parseDuration(iso: string): number` — 秒数。解釈できなければ `0`
  - `buildCatalog(raw: object, options?: { albumMinSeconds?, trackMinSeconds?, trackLimit? }): { albums: Album[], tracks: Track[] }`
  - `Album = { id, kind: 'video' | 'playlist', title, thumbnail, publishedAt, itemCount: number | null }`
  - `Track = { id, title, thumbnail, publishedAt, seconds: number, label: string }`（`label` は `4:13` 形式）
  - 既定値: `albumMinSeconds = 1200`, `trackMinSeconds = 60`, `trackLimit = 20`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/catalog.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, buildCatalog } from './catalog.js';

test('parseDuration: 分と秒', () => {
  assert.equal(parseDuration('PT4M13S'), 253);
});

test('parseDuration: 時間を含む', () => {
  assert.equal(parseDuration('PT1H2M3S'), 3723);
});

test('parseDuration: 秒だけ', () => {
  assert.equal(parseDuration('PT45S'), 45);
});

test('parseDuration: 壊れた値は0', () => {
  assert.equal(parseDuration('こわれている'), 0);
  assert.equal(parseDuration(undefined), 0);
});

const raw = {
  channelId: 'UCtest',
  videos: [
    { id: 'v1', title: '古い単曲', description: '', thumbnail: 't1', publishedAt: '2026-01-01T00:00:00Z', duration: 'PT4M13S' },
    { id: 'v2', title: '新しい単曲', description: '', thumbnail: 't2', publishedAt: '2026-06-01T00:00:00Z', duration: 'PT3M30S' },
    { id: 'v3', title: '1時間アルバム', description: '', thumbnail: 't3', publishedAt: '2026-05-01T00:00:00Z', duration: 'PT1H2M0S' },
    { id: 'v4', title: 'ショート', description: '', thumbnail: 't4', publishedAt: '2026-07-01T00:00:00Z', duration: 'PT42S' },
  ],
  playlists: [
    { id: 'p1', title: '再生リストのアルバム', description: '', thumbnail: 'tp1', publishedAt: '2026-05-15T00:00:00Z', itemCount: 12 },
  ],
};

test('buildCatalog: 20分以上の動画と再生リストがアルバムになる', () => {
  const { albums } = buildCatalog(raw);
  assert.deepEqual(albums.map((a) => a.id), ['p1', 'v3']);
  assert.equal(albums[0].kind, 'playlist');
  assert.equal(albums[0].itemCount, 12);
  assert.equal(albums[1].kind, 'video');
  assert.equal(albums[1].itemCount, null);
});

test('buildCatalog: 楽曲は新しい順で、ショートとアルバムを含まない', () => {
  const { tracks } = buildCatalog(raw);
  assert.deepEqual(tracks.map((t) => t.id), ['v2', 'v1']);
});

test('buildCatalog: 再生時間を表示用の文字列にする', () => {
  const { tracks } = buildCatalog(raw);
  assert.equal(tracks[1].label, '4:13');
});

test('buildCatalog: trackLimit で件数を絞る', () => {
  const { tracks } = buildCatalog(raw, { trackLimit: 1 });
  assert.deepEqual(tracks.map((t) => t.id), ['v2']);
});

test('buildCatalog: 空のデータでも落ちない', () => {
  const result = buildCatalog({});
  assert.deepEqual(result, { albums: [], tracks: [] });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`Cannot find module './catalog.js'`）

- [ ] **Step 3: 実装する**

`src/lib/catalog.js`:

```js
/** アルバムとみなす下限（秒）。1時間プレイリストなど。 */
export const ALBUM_MIN_SECONDS = 1200;
/** 楽曲とみなす下限（秒）。これ未満はShortsとして除外する。 */
export const TRACK_MIN_SECONDS = 60;

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** ISO8601の再生時間（PT4M13S）を秒に変換する。解釈できなければ0。 */
export function parseDuration(iso) {
  if (typeof iso !== 'string') return 0;
  const m = iso.match(ISO_DURATION);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return Number(d || 0) * 86400 + Number(h || 0) * 3600 + Number(min || 0) * 60 + Number(s || 0);
}

/** 秒を 4:13 / 1:02:00 の形にする。 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const byNewest = (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt);

/** 取得済みJSONを、表示用のアルバムと楽曲に振り分ける。 */
export function buildCatalog(raw, options = {}) {
  const {
    albumMinSeconds = ALBUM_MIN_SECONDS,
    trackMinSeconds = TRACK_MIN_SECONDS,
    trackLimit = 20,
  } = options;

  const videos = Array.isArray(raw?.videos) ? raw.videos : [];
  const playlists = Array.isArray(raw?.playlists) ? raw.playlists : [];

  const longVideos = videos
    .filter((v) => parseDuration(v.duration) >= albumMinSeconds)
    .map((v) => ({
      id: v.id,
      kind: 'video',
      title: v.title,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      itemCount: null,
    }));

  const playlistAlbums = playlists.map((p) => ({
    id: p.id,
    kind: 'playlist',
    title: p.title,
    thumbnail: p.thumbnail,
    publishedAt: p.publishedAt,
    itemCount: typeof p.itemCount === 'number' ? p.itemCount : null,
  }));

  const albums = [...longVideos, ...playlistAlbums].sort(byNewest);

  const tracks = videos
    .map((v) => ({ ...v, seconds: parseDuration(v.duration) }))
    .filter((v) => v.seconds >= trackMinSeconds && v.seconds < albumMinSeconds)
    .sort(byNewest)
    .slice(0, trackLimit)
    .map((v) => ({
      id: v.id,
      title: v.title,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      seconds: v.seconds,
      label: formatDuration(v.seconds),
    }));

  return { albums, tracks };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（9件すべて）

- [ ] **Step 5: コミット**

```bash
git add src/lib/catalog.js src/lib/catalog.test.mjs
git commit -m "feat: アルバムと楽曲を振り分けるカタログ整形を追加"
```

---

## Task 4: YouTube取得スクリプト

**Files:**
- Create: `scripts/fetch-youtube.mjs`
- Test: `scripts/fetch-youtube.test.mjs`
- Create: `src/data/youtube.json`（このタスクの最後に実データで生成）

**Interfaces:**
- Consumes: 環境変数 `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`（Task 1）
- Produces:
  - `normalizeVideo(item): Video` — Task 3 の `Video` 型
  - `normalizePlaylist(item): Playlist` — Task 3 の `Playlist` 型
  - `pickThumbnail(thumbnails): string`
  - `fetchChannelData({ apiKey, channelId, fetchImpl }): Promise<{ channelId, videos, playlists }>`
  - `src/data/youtube.json`（Task 3 の `buildCatalog` に渡せる形）

- [ ] **Step 1: 失敗するテストを書く**

`scripts/fetch-youtube.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickThumbnail, normalizeVideo, normalizePlaylist, fetchChannelData } from './fetch-youtube.mjs';

test('pickThumbnail: 大きいものを優先する', () => {
  const thumbs = {
    default: { url: 'small.jpg' },
    medium: { url: 'medium.jpg' },
    maxres: { url: 'max.jpg' },
  };
  assert.equal(pickThumbnail(thumbs), 'max.jpg');
});

test('pickThumbnail: 何も無ければ空文字', () => {
  assert.equal(pickThumbnail(undefined), '');
});

test('normalizeVideo: 必要な項目だけ取り出す', () => {
  const item = {
    id: 'abc123',
    snippet: {
      title: '夜の歌',
      description: '説明',
      publishedAt: '2026-06-01T00:00:00Z',
      thumbnails: { high: { url: 'high.jpg' } },
    },
    contentDetails: { duration: 'PT4M13S' },
  };
  assert.deepEqual(normalizeVideo(item), {
    id: 'abc123',
    title: '夜の歌',
    description: '説明',
    thumbnail: 'high.jpg',
    publishedAt: '2026-06-01T00:00:00Z',
    duration: 'PT4M13S',
  });
});

test('normalizePlaylist: 収録数を含める', () => {
  const item = {
    id: 'PL123',
    snippet: {
      title: 'アルバム1',
      description: '説明',
      publishedAt: '2026-05-01T00:00:00Z',
      thumbnails: { high: { url: 'p.jpg' } },
    },
    contentDetails: { itemCount: 12 },
  };
  assert.deepEqual(normalizePlaylist(item), {
    id: 'PL123',
    title: 'アルバム1',
    description: '説明',
    thumbnail: 'p.jpg',
    publishedAt: '2026-05-01T00:00:00Z',
    itemCount: 12,
  });
});

/** APIの応答を差し替える偽のfetch */
function makeFakeFetch(routes) {
  return async (url) => {
    for (const [needle, body] of routes) {
      if (url.includes(needle)) {
        return { ok: true, status: 200, json: async () => body };
      }
    }
    throw new Error(`想定外のURL: ${url}`);
  };
}

test('fetchChannelData: 動画と再生リストをまとめて返す', async () => {
  const fakeFetch = makeFakeFetch([
    ['/channels?', { items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] }],
    ['/playlistItems?', { items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] }],
    ['/videos?', {
      items: [
        { id: 'v1', snippet: { title: 'A', description: '', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { high: { url: 'a.jpg' } } }, contentDetails: { duration: 'PT4M0S' } },
        { id: 'v2', snippet: { title: 'B', description: '', publishedAt: '2026-02-01T00:00:00Z', thumbnails: { high: { url: 'b.jpg' } } }, contentDetails: { duration: 'PT1H0M0S' } },
      ],
    }],
    ['/playlists?', {
      items: [
        { id: 'PL1', snippet: { title: 'アルバム', description: '', publishedAt: '2026-03-01T00:00:00Z', thumbnails: { high: { url: 'p.jpg' } } }, contentDetails: { itemCount: 10 } },
      ],
    }],
  ]);

  const data = await fetchChannelData({ apiKey: 'KEY', channelId: 'UCtest', fetchImpl: fakeFetch });

  assert.equal(data.channelId, 'UCtest');
  assert.deepEqual(data.videos.map((v) => v.id), ['v1', 'v2']);
  assert.deepEqual(data.playlists.map((p) => p.id), ['PL1']);
});

test('fetchChannelData: APIがエラーを返したら例外にする', async () => {
  const failing = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: '上限に達しました' } }) });
  await assert.rejects(
    () => fetchChannelData({ apiKey: 'KEY', channelId: 'UCtest', fetchImpl: failing }),
    /上限に達しました/
  );
});

test('fetchChannelData: APIキーが無ければ例外にする', async () => {
  await assert.rejects(
    () => fetchChannelData({ apiKey: '', channelId: 'UCtest' }),
    /YOUTUBE_API_KEY/
  );
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`Cannot find module './fetch-youtube.mjs'`）

- [ ] **Step 3: 実装する**

`scripts/fetch-youtube.mjs`:

```js
import { writeFile } from 'node:fs/promises';

const API = 'https://www.googleapis.com/youtube/v3';
const OUTPUT = new URL('../src/data/youtube.json', import.meta.url);
/** 取得する動画の上限。1回のビルドで消費するクォータを抑えるため。 */
const MAX_VIDEOS = 300;

/** 一番大きいサムネイルのURLを返す。 */
export function pickThumbnail(thumbnails) {
  const order = ['maxres', 'standard', 'high', 'medium', 'default'];
  for (const key of order) {
    if (thumbnails?.[key]?.url) return thumbnails[key].url;
  }
  return '';
}

export function normalizeVideo(item) {
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description ?? '',
    thumbnail: pickThumbnail(item.snippet.thumbnails),
    publishedAt: item.snippet.publishedAt,
    duration: item.contentDetails?.duration ?? '',
  };
}

export function normalizePlaylist(item) {
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description ?? '',
    thumbnail: pickThumbnail(item.snippet.thumbnails),
    publishedAt: item.snippet.publishedAt,
    itemCount: item.contentDetails?.itemCount ?? 0,
  };
}

async function callApi(fetchImpl, url) {
  const res = await fetchImpl(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return body;
}

/** チャンネルの動画と公開再生リストをまとめて取得する。 */
export async function fetchChannelData({ apiKey, channelId, fetchImpl = globalThis.fetch }) {
  if (!apiKey) throw new Error('YOUTUBE_API_KEY が設定されていません');
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID が設定されていません');

  const channel = await callApi(
    fetchImpl,
    `${API}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
  );
  const uploadsId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error(`チャンネルが見つかりません: ${channelId}`);

  // アップロード済み動画のIDを集める
  const videoIds = [];
  let pageToken = '';
  do {
    const page = await callApi(
      fetchImpl,
      `${API}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=50&key=${apiKey}` +
        (pageToken ? `&pageToken=${pageToken}` : '')
    );
    for (const item of page.items ?? []) {
      if (item.contentDetails?.videoId) videoIds.push(item.contentDetails.videoId);
    }
    pageToken = page.nextPageToken ?? '';
  } while (pageToken && videoIds.length < MAX_VIDEOS);

  // 50件ずつ詳細（再生時間）を取る
  const videos = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50).join(',');
    const page = await callApi(
      fetchImpl,
      `${API}/videos?part=snippet,contentDetails&id=${chunk}&maxResults=50&key=${apiKey}`
    );
    for (const item of page.items ?? []) videos.push(normalizeVideo(item));
  }

  // 公開再生リスト
  const playlists = [];
  pageToken = '';
  do {
    const page = await callApi(
      fetchImpl,
      `${API}/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&key=${apiKey}` +
        (pageToken ? `&pageToken=${pageToken}` : '')
    );
    for (const item of page.items ?? []) playlists.push(normalizePlaylist(item));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);

  return { channelId, videos, playlists };
}

// コマンドから直接呼ばれたときだけ実行する
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fetch-youtube.mjs')) {
  try {
    const data = await fetchChannelData({
      apiKey: process.env.YOUTUBE_API_KEY,
      channelId: process.env.YOUTUBE_CHANNEL_ID,
    });
    if (data.videos.length === 0) throw new Error('動画が0件でした');
    await writeFile(OUTPUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`更新しました: 動画 ${data.videos.length}件 / 再生リスト ${data.playlists.length}件`);
  } catch (err) {
    // 取得に失敗しても、前回の src/data/youtube.json をそのまま使ってビルドを続ける
    console.warn(`::warning::YouTubeの取得に失敗しました。前回のデータを使います: ${err.message}`);
    process.exit(0);
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（Task 3 の9件と合わせて16件）

- [ ] **Step 5: 実データを取得する**

Run: `npm run fetch`
Expected: `更新しました: 動画 ○件 / 再生リスト ○件` と表示され、`src/data/youtube.json` が作られる。

`.env` が無い / キーが違う場合は警告だけ出て終了する（設計通りの挙動）。その場合は Task 1 に戻る。

- [ ] **Step 6: 中身をざっと確認する**

Run: `node -e "const d=require('./src/data/youtube.json');const {buildCatalog}=await import('./src/lib/catalog.js');const c=buildCatalog(d);console.log('アルバム',c.albums.length,'楽曲',c.tracks.length);console.log(c.albums.slice(0,3).map(a=>a.title));console.log(c.tracks.slice(0,3).map(t=>t.title+' '+t.label))"`

Expected: アルバムと楽曲の件数、実際のタイトルが日本語で表示される。
**ここで振り分けが意図と違ったら報告すること**（例: アルバムが0件、単曲がアルバム側に入っている）。閾値の1200秒を変える判断が必要になる。

- [ ] **Step 7: コミット**

```bash
git add scripts src/data/youtube.json
git commit -m "feat: YouTubeからの取得スクリプトと実データを追加"
```

---

## Task 5: ヘッダー・フッター・埋め込みURL

**Files:**
- Create: `src/lib/embed.js`, `src/components/Header.astro`, `src/components/Footer.astro`
- Test: `src/lib/embed.test.mjs`
- Modify: `src/layouts/BaseLayout.astro`（ヘッダーとフッターを差し込む）

**Interfaces:**
- Produces: `embedUrl(kind: 'video' | 'playlist', id: string): string`
- Produces: `src/lib/links.js` — SNSリンクの一覧（`LINKS: { label, url }[]`）。フッターと「聴けるところ」で共用する

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/embed.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedUrl } from './embed.js';

test('embedUrl: 動画は埋め込みURLに自動再生を付ける', () => {
  assert.equal(embedUrl('video', 'abc123'), 'https://www.youtube.com/embed/abc123?autoplay=1&rel=0');
});

test('embedUrl: 再生リストは videoseries を使う', () => {
  assert.equal(embedUrl('playlist', 'PL123'), 'https://www.youtube.com/embed/videoseries?list=PL123&autoplay=1&rel=0');
});

test('embedUrl: 不明な種別は空文字', () => {
  assert.equal(embedUrl('なにか', 'x'), '');
});

test('embedUrl: IDが無ければ空文字', () => {
  assert.equal(embedUrl('video', ''), '');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`Cannot find module './embed.js'`）

- [ ] **Step 3: embed.js を実装する**

```js
/** 動画/再生リストのIDから、モーダルに入れる埋め込みURLを作る。 */
export function embedUrl(kind, id) {
  if (!id) return '';
  if (kind === 'video') return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  if (kind === 'playlist') return `https://www.youtube.com/embed/videoseries?list=${id}&autoplay=1&rel=0`;
  return '';
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（20件）

- [ ] **Step 5: リンク一覧を作る**

`src/lib/links.js`:

```js
/**
 * 外部リンク。URLが未確定のものは空文字にしておくと、表示側で自動的に隠れる。
 * オーナーから正式なURLをもらったらここだけ書き換える。
 */
export const LINKS = [
  { label: 'YouTube', url: 'https://www.youtube.com/@nowa_music_jp' },
  { label: 'Spotify', url: '' },
  { label: 'Apple Music', url: '' },
  { label: 'TikTok', url: '' },
  { label: 'Instagram', url: '' },
];

export const CONTACT_EMAIL = '';

/** URLが入っているものだけ返す。 */
export const activeLinks = () => LINKS.filter((link) => link.url);
```

- [ ] **Step 6: Header.astro を作る**

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
    <a class="header__logo" href="/">NOWA</a>
    <nav class="header__nav">
      {items.map((item) => (
        <a href={item.href} aria-current={path.startsWith(item.href) ? 'page' : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
  </div>
</header>

<style>
  .header {
    position: absolute;
    inset: 0 0 auto;
    z-index: 10;
    padding-block: 1.25rem;
  }
  .header__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header__logo {
    font-size: 0.95rem;
    letter-spacing: 0.34em;
  }
  .header__nav {
    display: flex;
    gap: 1.5rem;
    font-size: 0.7rem;
    letter-spacing: 0.24em;
    color: var(--text-dim);
  }
  .header__nav a:hover,
  .header__nav a[aria-current='page'] {
    color: var(--accent);
  }
</style>
```

- [ ] **Step 7: Footer.astro を作る**

```astro
---
import { activeLinks, CONTACT_EMAIL } from '../lib/links.js';

const links = activeLinks();
const year = new Date().getFullYear();
---

<footer class="footer">
  <div class="container">
    <nav class="footer__links">
      {links.map((link) => (
        <a href={link.url} target="_blank" rel="noopener">{link.label}</a>
      ))}
    </nav>
    {CONTACT_EMAIL && (
      <p class="footer__mail"><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    )}
    <p class="footer__copy">© {year} Nowa Music</p>
  </div>
</footer>

<style>
  .footer {
    border-top: 1px solid var(--line);
    padding-block: 3rem 4rem;
    text-align: center;
    color: var(--text-dim);
  }
  .footer__links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.25rem 2rem;
    font-size: 0.75rem;
    letter-spacing: 0.18em;
  }
  .footer__links a:hover { color: var(--accent); }
  .footer__mail { font-size: 0.8rem; margin: 1.5rem 0 0; }
  .footer__copy { font-size: 0.7rem; letter-spacing: 0.2em; margin: 2rem 0 0; }
</style>
```

- [ ] **Step 8: BaseLayout に組み込む**

`src/layouts/BaseLayout.astro` の import に追加:

```astro
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
```

`<body>` の中を以下に差し替える:

```astro
    <Header />
    <slot />
    <Footer />
```

- [ ] **Step 9: 表示を確認する**

Run: `npm run dev`
Expected: `http://localhost:4321` の上部に `NOWA / MUSIC ABOUT`、下部にYouTubeリンクと `© 2026 Nowa Music` が出る。375px幅でも折り返して崩れない。

- [ ] **Step 10: コミット**

```bash
git add src/lib src/components src/layouts
git commit -m "feat: ヘッダー・フッターと埋め込みURLの生成を追加"
```

---

## Task 6: プレイヤーモーダル

クリックした曲をサイト内で再生する。1ページに1つ置き、`data-play` を持つ要素はすべてこれが拾う。

**Files:**
- Create: `src/components/Player.astro`
- Modify: `src/layouts/BaseLayout.astro`（`<Player />` を追加）

**Interfaces:**
- Consumes: `embedUrl()`（Task 5）
- Produces: HTML契約 — 任意の要素に `data-play="video:<id>"` または `data-play="playlist:<id>"` と `data-title="<表示名>"` を付ければ、クリックでモーダルが開く。以降のコンポーネントはこの属性を付けるだけでよい

- [ ] **Step 1: Player.astro を作る**

```astro
---
// 画面全体をおおうプレイヤー。data-play を持つ要素のクリックで開く。
---

<div class="player" id="player" hidden>
  <div class="player__backdrop" data-player-close></div>
  <div class="player__panel" role="dialog" aria-modal="true" aria-label="プレイヤー">
    <button class="player__close" type="button" data-player-close aria-label="閉じる">×</button>
    <div class="player__frame" id="player-frame"></div>
    <p class="player__title" id="player-title"></p>
  </div>
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 1rem;
  }
  .player[hidden] { display: none; }
  .player__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(4, 8, 18, 0.88);
    backdrop-filter: blur(6px);
  }
  .player__panel {
    position: relative;
    width: min(100%, 56rem);
  }
  .player__close {
    position: absolute;
    top: -2.6rem;
    right: 0;
    background: none;
    border: none;
    color: var(--text);
    font-size: 1.8rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }
  .player__close:hover { color: var(--accent); }
  .player__frame {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #000;
    border: 1px solid var(--line);
  }
  .player__frame :global(iframe) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .player__title {
    margin: 1rem 0 0;
    font-size: 0.85rem;
    color: var(--text-dim);
    text-align: center;
  }
</style>

<script>
  import { embedUrl } from '../lib/embed.js';

  const player = document.getElementById('player');
  const frame = document.getElementById('player-frame');
  const titleEl = document.getElementById('player-title');

  function open(kind, id, title) {
    const src = embedUrl(kind, id);
    if (!src) return;
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = title || 'Nowa Music';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    frame.replaceChildren(iframe);
    titleEl.textContent = title || '';
    player.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    // iframeを消さないと音が鳴り続ける
    frame.replaceChildren();
    titleEl.textContent = '';
    player.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-play]');
    if (trigger) {
      event.preventDefault();
      const [kind, id] = trigger.dataset.play.split(':');
      open(kind, id, trigger.dataset.title);
      return;
    }
    if (event.target.closest('[data-player-close]')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !player.hidden) close();
  });
</script>
```

- [ ] **Step 2: BaseLayout に組み込む**

import に `import Player from '../components/Player.astro';` を追加し、`<Footer />` の直後に `<Player />` を置く。

- [ ] **Step 3: 動作確認用のボタンを一時的に置く**

`src/pages/index.astro` の `<h1>` の下に追加:

```astro
  <button type="button" data-play="video:dQw4w9WgXcQ" data-title="動作確認">再生テスト</button>
```

- [ ] **Step 4: 手で動作を確認する**

Run: `npm run dev` → `http://localhost:4321`

確認すること（すべて満たすこと）:
1. 「再生テスト」を押すとモーダルが開き、動画が自動再生される
2. `×` を押すと閉じ、**音が止まる**
3. 背景の暗い部分を押しても閉じる
4. Escキーでも閉じる
5. モーダルが開いている間、背後のページがスクロールしない
6. 375px幅でも動画が画面内に収まる

- [ ] **Step 5: 確認用ボタンを消す**

Step 3 で足した `<button>` の行を削除する。

- [ ] **Step 6: ビルドが通ることを確認してコミット**

```bash
npm run build
git add src/components/Player.astro src/layouts/BaseLayout.astro
git commit -m "feat: サイト内で再生するプレイヤーモーダルを追加"
```

---

## Task 7: アルバム棚と楽曲リスト

**Files:**
- Create: `src/components/AlbumShelf.astro`, `src/components/TrackList.astro`

**Interfaces:**
- Consumes: Task 3 の `Album` / `Track`、Task 6 の `data-play` 契約
- Produces:
  - `<AlbumShelf albums={Album[]} limit={number} />`
  - `<TrackList tracks={Track[]} limit={number} />`

- [ ] **Step 1: AlbumShelf.astro を作る**

```astro
---
const { albums = [], limit } = Astro.props;
const items = typeof limit === 'number' ? albums.slice(0, limit) : albums;
---

<div class="shelf">
  {items.map((album) => (
    <button
      class="album"
      type="button"
      data-play={`${album.kind}:${album.id}`}
      data-title={album.title}
    >
      <span class="album__art">
        {album.thumbnail ? (
          <img src={album.thumbnail} alt="" loading="lazy" width="480" height="270" />
        ) : (
          <span class="album__art--empty"></span>
        )}
        <span class="album__play">▶</span>
      </span>
      <span class="album__title">{album.title}</span>
      {album.itemCount && <span class="album__meta">{album.itemCount}曲</span>}
    </button>
  ))}
</div>

<style>
  .shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 2rem 1.5rem;
  }
  .album {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .album__art {
    position: relative;
    display: block;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--bg-deep);
  }
  .album__art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.82;
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .album__art--empty {
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(140deg, var(--bg-mid), var(--bg-far));
  }
  .album__play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 1.4rem;
    color: var(--text);
    opacity: 0;
    transition: opacity 0.4s ease;
    text-shadow: 0 0 1rem rgba(4, 8, 18, 0.9);
  }
  .album:hover .album__art img,
  .album:focus-visible .album__art img { opacity: 1; transform: scale(1.03); }
  .album:hover .album__play,
  .album:focus-visible .album__play { opacity: 1; }
  .album__title {
    display: block;
    margin-top: 0.9rem;
    font-size: 0.9rem;
    line-height: 1.7;
  }
  .album__meta {
    display: block;
    margin-top: 0.3rem;
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    color: var(--text-dim);
  }
</style>
```

- [ ] **Step 2: TrackList.astro を作る**

```astro
---
const { tracks = [], limit } = Astro.props;
const items = typeof limit === 'number' ? tracks.slice(0, limit) : tracks;
---

<ol class="tracks">
  {items.map((track, index) => (
    <li>
      <button class="track" type="button" data-play={`video:${track.id}`} data-title={track.title}>
        <span class="track__no">{String(index + 1).padStart(2, '0')}</span>
        <span class="track__title">{track.title}</span>
        <span class="track__time">{track.label}</span>
      </button>
    </li>
  ))}
</ol>

<style>
  .tracks {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
  }
  .tracks li { border-bottom: 1px solid var(--line); }
  .track {
    display: grid;
    grid-template-columns: 2.5rem 1fr auto;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1.1rem 0.25rem;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: color 0.4s ease;
  }
  .track:hover, .track:focus-visible { color: var(--accent); }
  .track__no {
    font-size: 0.7rem;
    letter-spacing: 0.16em;
    color: var(--text-dim);
  }
  .track__title {
    font-size: 0.92rem;
    line-height: 1.6;
  }
  .track__time {
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
</style>
```

- [ ] **Step 3: 一時的にトップに置いて確認する**

`src/pages/index.astro` を一時的に以下にする:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AlbumShelf from '../components/AlbumShelf.astro';
import TrackList from '../components/TrackList.astro';
import raw from '../data/youtube.json';
import { buildCatalog } from '../lib/catalog.js';

const { albums, tracks } = buildCatalog(raw);
---

<BaseLayout>
  <main class="container section">
    <h1 class="section__title">確認用</h1>
    <AlbumShelf albums={albums} limit={8} />
    <TrackList tracks={tracks} limit={6} />
  </main>
</BaseLayout>
```

Run: `npm run dev`

確認すること:
1. 実際のアルバムのサムネイルが並ぶ
2. アルバムを押すとプレイヤーが開いて再生される
3. 楽曲リストの曲を押しても再生される
4. 375px幅でアルバムが1列、タイトルが読める大きさで並ぶ

- [ ] **Step 4: コミット**

（`index.astro` は次のタスクで作り直すので、ここではコンポーネントだけコミットする）

```bash
git add src/components/AlbumShelf.astro src/components/TrackList.astro
git commit -m "feat: アルバム棚と楽曲リストのコンポーネントを追加"
```

---

## Task 8: トップページ

**Files:**
- Modify: `src/pages/index.astro`（全面的に書き直す）
- Create: `src/assets/hero.jpg`（オーナーから受け取ったキャラクター画像。縦長1枚）

**Interfaces:**
- Consumes: `buildCatalog`（Task 3）、`AlbumShelf` / `TrackList`（Task 7）、`activeLinks`（Task 5）

- [ ] **Step 1: ヒーロー画像を置く**

オーナーから受け取った縦長のキャラクター画像を `src/assets/hero.jpg` として保存する。
**まだ画像が無い場合**は、このタスクの Step 2 で画像なしの見た目（グラデーションのみ）で作り、画像が届いた時点で差し替える。その場合はオーナーに「ヒーロー画像が未提供」と報告すること。

- [ ] **Step 2: index.astro を書く**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AlbumShelf from '../components/AlbumShelf.astro';
import TrackList from '../components/TrackList.astro';
import raw from '../data/youtube.json';
import { buildCatalog } from '../lib/catalog.js';
import { activeLinks } from '../lib/links.js';

const { albums, tracks } = buildCatalog(raw);
const links = activeLinks();
// ヒーローの再生ボタンは最新の1曲（無ければ最新アルバム）
const tonight = tracks[0] ?? albums[0];
const tonightPlay = tonight ? `${tonight.kind ?? 'video'}:${tonight.id}` : '';
---

<BaseLayout>
  <section class="hero">
    <div class="hero__art"></div>
    <div class="container hero__body">
      <p class="hero__label">NOWA MUSIC</p>
      <h1 class="hero__copy">夜が、<br />ひとりを<br />やさしくする。</h1>
      {tonight && (
        <button class="hero__play" type="button" data-play={tonightPlay} data-title={tonight.title}>
          ▶ 今夜の1曲
        </button>
      )}
    </div>
  </section>

  <section class="section words">
    <div class="container">
      <p class="reveal">言えなかった気持ち、忘れられない名前、あの頃の恋。</p>
      <p class="reveal">そして、一日をやり終えて、ひとりになった夜の時間。</p>
      <p class="reveal">大人になった今だからわかる感情を、静かな歌にしています。</p>
    </div>
  </section>

  <section class="section" id="albums">
    <div class="container reveal">
      <p class="section__label">ALBUM</p>
      <h2 class="section__title">ゆっくり流せる、夜のためのアルバム。</h2>
      <AlbumShelf albums={albums} limit={8} />
      {albums.length > 8 && <p class="more"><a href="/music/">すべてのアルバムを見る</a></p>}
    </div>
  </section>

  <section class="section" id="tracks">
    <div class="container reveal">
      <p class="section__label">NEW SONGS</p>
      <h2 class="section__title">新しい歌。</h2>
      <TrackList tracks={tracks} limit={6} />
      <p class="more"><a href="/music/">楽曲をもっと見る</a></p>
    </div>
  </section>

  <section class="section" id="about">
    <div class="container reveal about">
      <p class="section__label">ABOUT</p>
      <h2 class="section__title">Nowa について</h2>
      <p>眠れない夜、疲れた夜、ひとりで過ごす時間に。<br />オリジナルの単曲と、ゆっくり流せる1時間のプレイリストをお届けしています。</p>
      <p class="more"><a href="/about/">もっと読む</a></p>
    </div>
  </section>

  {links.length > 0 && (
    <section class="section" id="listen">
      <div class="container reveal">
        <p class="section__label">LISTEN</p>
        <h2 class="section__title">聴けるところ</h2>
        <ul class="listen">
          {links.map((link) => (
            <li><a href={link.url} target="_blank" rel="noopener">{link.label}</a></li>
          ))}
        </ul>
      </div>
    </section>
  )}
</BaseLayout>

<style>
  .hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    align-items: flex-end;
    padding-block: 8rem 4rem;
    overflow: hidden;
  }
  .hero__art {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(180deg, rgba(7, 13, 28, 0.35) 0%, rgba(7, 13, 28, 0.75) 55%, var(--bg-deep) 100%),
      url('../assets/hero.jpg');
    background-size: cover;
    background-position: center 20%;
  }
  .hero__body { position: relative; }
  .hero__label {
    font-size: 0.68rem;
    letter-spacing: 0.36em;
    color: var(--accent);
    margin: 0 0 1.5rem;
  }
  .hero__copy {
    font-size: clamp(1.9rem, 8vw, 3.2rem);
    font-weight: 200;
    line-height: 1.8;
    margin: 0 0 2.5rem;
  }
  .hero__play {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1.8rem;
    border: 1px solid var(--accent);
    border-radius: 999px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 0.8rem;
    letter-spacing: 0.18em;
    cursor: pointer;
    transition: background 0.5s ease, color 0.5s ease;
  }
  .hero__play:hover { background: var(--accent); color: var(--bg-deep); }

  .words { text-align: center; }
  .words p {
    font-size: clamp(1rem, 3.6vw, 1.25rem);
    line-height: 2.4;
    margin: 0 0 1.5rem;
  }
  .words p:nth-child(2) { transition-delay: 0.15s; }
  .words p:nth-child(3) { transition-delay: 0.3s; }

  .more { margin-top: 2.5rem; font-size: 0.78rem; letter-spacing: 0.18em; }
  .more a { color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 0.2rem; }

  .about p { max-width: 34rem; }

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
</style>
```

**画像がまだ無い場合**は `.hero__art` の `url('../assets/hero.jpg')` の行を消し、グラデーションだけにする。

- [ ] **Step 3: 表示を確認する**

Run: `npm run dev`

確認すること:
1. 最初の画面がほぼ全画面のビジュアルで、コピーと再生ボタンだけが見える
2. 「今夜の1曲」でプレイヤーが開く
3. スクロールすると3行の文章が順にゆっくり現れる
4. アルバム → 新着曲 → About → 聴けるところ の順に並ぶ
5. 375px幅で横スクロールが発生しない

- [ ] **Step 4: ビルドを確認してコミット**

```bash
npm run build
git add src/pages/index.astro src/assets
git commit -m "feat: トップページを作成"
```

---

## Task 9: /music と /about

**Files:**
- Create: `src/pages/music.astro`, `src/pages/about.astro`

**Interfaces:**
- Consumes: Task 3、Task 5、Task 7 のすべて

- [ ] **Step 1: music.astro を作る**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AlbumShelf from '../components/AlbumShelf.astro';
import TrackList from '../components/TrackList.astro';
import raw from '../data/youtube.json';
import { buildCatalog } from '../lib/catalog.js';

const { albums, tracks } = buildCatalog(raw);
---

<BaseLayout title="MUSIC" description="Nowa Music のアルバムと最新の楽曲。夜にそっと寄り添う女性ボーカルのJ-POPバラード。">
  <main>
    <section class="section head">
      <div class="container">
        <p class="section__label">MUSIC</p>
        <h1 class="section__title">夜のための、アルバムと歌。</h1>
      </div>
    </section>

    <section class="section">
      <div class="container reveal">
        <h2 class="section__title">ALBUM</h2>
        <AlbumShelf albums={albums} />
      </div>
    </section>

    <section class="section">
      <div class="container reveal">
        <h2 class="section__title">SONGS</h2>
        <TrackList tracks={tracks} />
        <p class="more">
          <a href="https://www.youtube.com/@nowa_music_jp/videos" target="_blank" rel="noopener">
            もっと聴く（YouTubeチャンネル）
          </a>
        </p>
      </div>
    </section>
  </main>
</BaseLayout>

<style>
  .head { padding-top: 9rem; }
  .more { margin-top: 2.5rem; font-size: 0.78rem; letter-spacing: 0.18em; }
  .more a { color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 0.2rem; }
</style>
```

- [ ] **Step 2: about.astro を作る**

本文はオーナーから最終稿をもらうまで、チャンネル説明文をそのまま使う。

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { activeLinks } from '../lib/links.js';

const links = activeLinks();
---

<BaseLayout title="ABOUT" description="Nowa Music について。夜にそっと寄り添う、女性ボーカルのJ-POPバラード。">
  <main>
    <section class="section head">
      <div class="container">
        <p class="section__label">ABOUT</p>
        <h1 class="section__title">Nowa</h1>
      </div>
    </section>

    <section class="section">
      <div class="container profile">
        <div class="profile__art reveal"></div>
        <div class="profile__text reveal">
          <p>夜にそっと寄り添う、女性ボーカルのJ-POPバラード。</p>
          <p>言えなかった気持ち、忘れられない名前、あの頃の恋。<br />そして、一日をやり終えて、ひとりになった夜の時間。</p>
          <p>大人になった今だからわかる感情を、静かな歌にしています。</p>
          <p>眠れない夜、疲れた夜、ひとりで過ごす時間に。<br />オリジナルの単曲と、ゆっくり流せる1時間のプレイリストをお届けしています。</p>
        </div>
      </div>
    </section>

    {links.length > 0 && (
      <section class="section">
        <div class="container reveal">
          <p class="section__label">LISTEN</p>
          <ul class="listen">
            {links.map((link) => (
              <li><a href={link.url} target="_blank" rel="noopener">{link.label}</a></li>
            ))}
          </ul>
        </div>
      </section>
    )}
  </main>
</BaseLayout>

<style>
  .head { padding-top: 9rem; }
  .profile {
    display: grid;
    gap: 3rem;
    grid-template-columns: 1fr;
  }
  @media (min-width: 48rem) {
    .profile { grid-template-columns: 1fr 1.2fr; gap: 4rem; align-items: start; }
  }
  .profile__art {
    aspect-ratio: 3 / 4;
    border: 1px solid var(--line);
    background:
      linear-gradient(180deg, rgba(7, 13, 28, 0.2), rgba(7, 13, 28, 0.85)),
      linear-gradient(140deg, var(--bg-mid), var(--bg-far));
    background-size: cover;
    background-position: center;
  }
  .profile__text p { margin: 0 0 2rem; }
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
</style>
```

**キャラクター画像がある場合**は `.profile__art` の2つ目の `linear-gradient(140deg, ...)` を `url('../assets/portrait.jpg')` に置き換え、画像を `src/assets/portrait.jpg` に置く。

- [ ] **Step 3: 3ページを通して確認する**

Run: `npm run dev`

確認すること:
1. ヘッダーの MUSIC / ABOUT でページ移動でき、現在地がアクセント色になる
2. `/music/` にアルバム全部と最新20曲が並び、どちらもクリックで再生できる
3. `/about/` の文章が読みやすい幅で収まっている
4. 3ページとも 375px 幅で横スクロールが出ない

- [ ] **Step 4: ビルドを確認してコミット**

```bash
npm run build
```

Expected: `dist/index.html`, `dist/music/index.html`, `dist/about/index.html` が生成される。

```bash
git add src/pages
git commit -m "feat: MUSICページとABOUTページを作成"
```

---

## Task 10: 自動更新と公開

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `docs/運用メモ.md`

**Interfaces:**
- Consumes: Secrets `YOUTUBE_API_KEY` / `YOUTUBE_CHANNEL_ID`（Task 1）、`public/CNAME`（Task 2）

- [ ] **Step 1: ワークフローを作る**

`.github/workflows/deploy.yml`:

```yaml
name: 更新と公開

on:
  push:
    branches: [main]
  schedule:
    # 毎日 06:00 JST（UTC 21:00）
    - cron: '0 21 * * *'
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - name: テスト
        run: npm test

      - name: YouTubeから取得
        env:
          YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}
          YOUTUBE_CHANNEL_ID: ${{ secrets.YOUTUBE_CHANNEL_ID }}
        run: node scripts/fetch-youtube.mjs

      - name: 変更があれば取得結果をコミット
        run: |
          if [ -n "$(git status --porcelain src/data/youtube.json)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add src/data/youtube.json
            git commit -m "chore: YouTubeのデータを更新"
            git push
          else
            echo "更新なし"
          fi

      - name: ビルド
        run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: GitHub Pages を有効にする**

Run:

```bash
gh api -X POST repos/:owner/nowa-music/pages -f build_type=workflow || \
gh api -X PUT repos/:owner/nowa-music/pages -f build_type=workflow
```

うまくいかない場合はブラウザで: リポジトリ → Settings → Pages → Source を **GitHub Actions** に設定する。

- [ ] **Step 3: プッシュして動かす**

```bash
git add .github
git commit -m "ci: 日次の自動更新とGitHub Pagesへの公開を追加"
git push -u origin main
gh run watch
```

Expected: `build` と `deploy` が両方成功する。

失敗した場合の見方:
- `npm test` で落ちた → テストを直す
- `YouTubeから取得` で警告のみ → Secretsの登録漏れ。`gh secret list` を確認
- `git push` で落ちた → リポジトリの Settings → Actions → General → Workflow permissions を **Read and write permissions** にする

- [ ] **Step 4: 公開されたことを確認する**

Run: `gh browse` または `https://<ユーザー名>.github.io/nowa-music/`

Expected: サイトが表示される（この時点ではまだドメイン未接続なので、CNAMEの影響で表示が不安定なことがある。次のステップで解消する）。

- [ ] **Step 5: ドメインを繋ぐ（オーナーの作業）**

Squarespace にログイン → ドメイン → `nowajp.com` → DNS設定 で以下を追加する:

| タイプ | ホスト | 値 |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<GitHubユーザー名>.github.io` |

その後、リポジトリの Settings → Pages → Custom domain に `nowajp.com` を入力して保存し、**Enforce HTTPS** にチェックを入れる（証明書の発行に最大1時間ほどかかる）。

- [ ] **Step 6: 反映を確認する**

Run:

```bash
nslookup nowajp.com
curl -sI https://nowajp.com | head -3
```

Expected: A レコードに `185.199.*` が並び、`HTTP/2 200` が返る。
反映には数十分〜半日かかる。すぐに繋がらなくても設定は正しい可能性が高いので、時間をおいて再確認する。

ブラウザで確認すること:
1. `https://nowajp.com` が鍵マーク付きで開く
2. `https://www.nowajp.com` も `nowajp.com` に繋がる
3. スマホの実機で開いて、ヒーローとアルバムが崩れていない

- [ ] **Step 7: 運用メモを書く**

`docs/運用メモ.md`:

```markdown
# Nowa Music サイト 運用メモ

## 新曲・新アルバムを出したとき

何もしなくてよい。毎朝6時（日本時間）にYouTubeから自動で取り込まれ、サイトが更新される。

## すぐ反映したいとき

GitHubのリポジトリ → Actions → 「更新と公開」→ 「Run workflow」を押す。3分ほどで反映される。

## 変えたくなったときの場所

| 変えたいもの | ファイル |
|---|---|
| SNS・サブスクのリンク、メールアドレス | `src/lib/links.js` |
| トップのキャッチコピー | `src/pages/index.astro` |
| ABOUTの文章 | `src/pages/about.astro` |
| 配色・書体 | `src/styles/theme.css` |
| アルバムの判定時間（既定20分） | `src/lib/catalog.js` の `ALBUM_MIN_SECONDS` |
| 表示する楽曲数（既定20曲） | `src/lib/catalog.js` の `trackLimit` |

## サイトが更新されなくなったら

1. Actions のログを見る。「YouTubeの取得に失敗しました」と出ていたらAPIの問題
2. よくある原因: APIの1日の上限（無料枠1万ユニット）超過 → 翌日に自動復旧する
3. Google Cloud のプロジェクトが無効化されていないか確認する
4. 取得に失敗しても、サイトは前回のデータで表示され続ける（真っ白にはならない）

## ドメイン

`nowajp.com` は Squarespace で管理。**有効期限 2026/10/04** — 自動更新の設定を確認しておくこと。切れるとサイトが見えなくなる。
```

- [ ] **Step 8: コミット**

```bash
git add docs/運用メモ.md
git commit -m "docs: 運用メモを追加"
git push
```

---

## 完了の定義

- [ ] `npm test` が全件パスする
- [ ] `https://nowajp.com` がHTTPSで開き、3ページとも動く
- [ ] トップの「今夜の1曲」とアルバム・楽曲のクリックで、サイト内で再生できる
- [ ] Actions を手動実行すると3分以内にサイトが更新される
- [ ] 375px幅で3ページとも横スクロールが出ない

## オーナーからの提供待ちで、届き次第差し替えるもの

| もの | 反映先 | 未提供時の暫定 |
|---|---|---|
| ヒーロー用の縦長キャラクター画像 | `src/assets/hero.jpg` | グラデーションのみ |
| ABOUT用のキャラクター画像 | `src/assets/portrait.jpg` | グラデーションのみ |
| Spotify / Apple Music / TikTok / Instagram のURL | `src/lib/links.js` | 空文字（自動的に非表示） |
| 公開用メールアドレス | `src/lib/links.js` の `CONTACT_EMAIL` | 空文字（自動的に非表示） |
| ヒーローのキャッチコピー最終稿 | `src/pages/index.astro` | 「夜が、ひとりをやさしくする。」 |
