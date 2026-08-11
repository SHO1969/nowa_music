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
