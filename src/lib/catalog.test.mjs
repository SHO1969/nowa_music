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
