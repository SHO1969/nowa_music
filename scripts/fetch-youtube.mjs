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
