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

/**
 * URLごとの呼び出し回数に応じて応答を切り替える偽のfetch。
 * ページングのテストのため、同じエンドポイントへの複数回の呼び出しを区別できるようにする。
 * routes の各エントリは [URLに含まれる文字列, 応答] で、応答は
 * - 配列なら「その文字列にマッチした回数目（0始まり、最後の要素で頭打ち）」の要素を使う
 * - 関数なら (呼び出し回数, url) => 応答本体 として呼ぶ
 * 呼ばれたURLは fetchImpl.calls に記録される。
 */
function makeSequencedFetch(routes) {
  const calls = [];
  const counts = new Map();
  const fetchImpl = async (url) => {
    calls.push(url);
    for (const [needle, responder] of routes) {
      if (url.includes(needle)) {
        const n = counts.get(needle) ?? 0;
        counts.set(needle, n + 1);
        const body =
          typeof responder === 'function' ? responder(n, url) : responder[Math.min(n, responder.length - 1)];
        return { ok: true, status: 200, json: async () => body };
      }
    }
    throw new Error(`想定外のURL: ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test('fetchChannelData: uploads が複数ページにまたがる場合、両ページの動画を漏れなく集める', async () => {
  const fetchImpl = makeSequencedFetch([
    ['/channels?', () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] })],
    [
      '/playlistItems?',
      [
        { items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }], nextPageToken: 'PAGE2' },
        { items: [{ contentDetails: { videoId: 'v3' } }] },
      ],
    ],
    ['/videos?', () => ({
      items: [
        { id: 'v1', snippet: { title: 'A', description: '', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { high: { url: 'a.jpg' } } }, contentDetails: { duration: 'PT4M0S' } },
        { id: 'v2', snippet: { title: 'B', description: '', publishedAt: '2026-02-01T00:00:00Z', thumbnails: { high: { url: 'b.jpg' } } }, contentDetails: { duration: 'PT1H0M0S' } },
        { id: 'v3', snippet: { title: 'C', description: '', publishedAt: '2026-03-01T00:00:00Z', thumbnails: { high: { url: 'c.jpg' } } }, contentDetails: { duration: 'PT3M0S' } },
      ],
    })],
    ['/playlists?', () => ({ items: [] })],
  ]);

  const data = await fetchChannelData({ apiKey: 'KEY', channelId: 'UCtest', fetchImpl });

  assert.deepEqual(data.videos.map((v) => v.id), ['v1', 'v2', 'v3']);

  const playlistItemsCalls = fetchImpl.calls.filter((u) => u.includes('/playlistItems?'));
  assert.equal(playlistItemsCalls.length, 2);
  assert.ok(!playlistItemsCalls[0].includes('pageToken='), '1ページ目にはpageTokenを付けない');
  assert.ok(playlistItemsCalls[1].includes('pageToken=PAGE2'), '2ページ目にはnextPageTokenを引き継ぐ');
});

test('fetchChannelData: playlists が複数ページにまたがる場合、両ページを漏れなく集める', async () => {
  const fetchImpl = makeSequencedFetch([
    ['/channels?', () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] })],
    ['/playlistItems?', () => ({ items: [] })],
    ['/videos?', () => ({ items: [] })],
    [
      '/playlists?',
      [
        {
          items: [
            { id: 'PL1', snippet: { title: 'アルバムA', description: '', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { high: { url: 'a.jpg' } } }, contentDetails: { itemCount: 5 } },
          ],
          nextPageToken: 'PAGE2',
        },
        {
          items: [
            { id: 'PL2', snippet: { title: 'アルバムB', description: '', publishedAt: '2026-02-01T00:00:00Z', thumbnails: { high: { url: 'b.jpg' } } }, contentDetails: { itemCount: 8 } },
          ],
        },
      ],
    ],
  ]);

  const data = await fetchChannelData({ apiKey: 'KEY', channelId: 'UCtest', fetchImpl });

  assert.deepEqual(data.playlists.map((p) => p.id), ['PL1', 'PL2']);

  const playlistsCalls = fetchImpl.calls.filter((u) => u.includes('/playlists?'));
  assert.equal(playlistsCalls.length, 2);
  assert.ok(!playlistsCalls[0].includes('pageToken='), '1ページ目にはpageTokenを付けない');
  assert.ok(playlistsCalls[1].includes('pageToken=PAGE2'), '2ページ目にはnextPageTokenを引き継ぐ');
});

test('fetchChannelData: nextPageToken が返り続けても MAX_VIDEOS で打ち切る（無限ループしない）', async () => {
  const fetchImpl = makeSequencedFetch([
    ['/channels?', () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] })],
    // 何回呼ばれても常に50件 + nextPageTokenを返し続ける（本番でチャンネルの動画がどれだけ増えても打ち切られることを確認する）
    [
      '/playlistItems?',
      (n) => ({
        items: Array.from({ length: 50 }, (_, i) => ({ contentDetails: { videoId: `v${n * 50 + i}` } })),
        nextPageToken: 'MORE',
      }),
    ],
    [
      '/videos?',
      (n) => ({
        items: Array.from({ length: 50 }, (_, i) => {
          const id = `v${n * 50 + i}`;
          return {
            id,
            snippet: { title: id, description: '', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { high: { url: `${id}.jpg` } } },
            contentDetails: { duration: 'PT3M0S' },
          };
        }),
      }),
    ],
    ['/playlists?', () => ({ items: [] })],
  ]);

  const data = await fetchChannelData({ apiKey: 'KEY', channelId: 'UCtest', fetchImpl });

  assert.equal(data.videos.length, 300);
  assert.equal(data.videos[0].id, 'v0');
  assert.equal(data.videos[299].id, 'v299');

  const playlistItemsCalls = fetchImpl.calls.filter((u) => u.includes('/playlistItems?'));
  assert.equal(playlistItemsCalls.length, 300 / 50);
});
