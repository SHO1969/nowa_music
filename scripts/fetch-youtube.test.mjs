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
