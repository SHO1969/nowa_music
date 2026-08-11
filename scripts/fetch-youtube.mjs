import { writeFile } from 'node:fs/promises';

const API = 'https://www.googleapis.com/youtube/v3';
const OUTPUT = new URL('../src/data/youtube.json', import.meta.url);
/**
 * 取得する動画の上限。無限ループ防止のための安全弁で、クォータを気にする必要はない
 * （playlistItems.list・videos.listは1回1ユニットで、1500本取得しても消費は1日の
 * 無料枠1万ユニットのごく一部）。この上限に達すると、それより古い動画（20分超の
 * 長尺アルバムを含む）が棚から静かに載らなくなるので、チャンネルの動画数が
 * この値に近づいてきたら引き上げること。
 */
export const MAX_VIDEOS = 1500;
/** 公開再生リストのページング上限（ページ数）。uploadsの動画と同様、無限ループを避けるための安全弁。 */
export const MAX_PLAYLIST_PAGES = 20;

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
export async function fetchChannelData({
  apiKey,
  channelId,
  fetchImpl = globalThis.fetch,
  maxVideos = MAX_VIDEOS,
  maxPlaylistPages = MAX_PLAYLIST_PAGES,
}) {
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
  } while (pageToken && videoIds.length < maxVideos);

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
  let playlistPage = 0;
  do {
    const page = await callApi(
      fetchImpl,
      `${API}/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&key=${apiKey}` +
        (pageToken ? `&pageToken=${pageToken}` : '')
    );
    for (const item of page.items ?? []) playlists.push(normalizePlaylist(item));
    pageToken = page.nextPageToken ?? '';
    playlistPage += 1;
  } while (pageToken && playlistPage < maxPlaylistPages);

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
