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
