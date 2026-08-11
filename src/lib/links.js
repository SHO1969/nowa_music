/**
 * 外部リンク。URLが未確定のものは空文字にしておくと、表示側で自動的に隠れる。
 * オーナーから正式なURLをもらったらここだけ書き換える。
 */
export const LINKS = [
  { label: 'YouTube', url: 'https://www.youtube.com/@nowa_music_jp' },
  { label: 'Spotify', url: 'https://open.spotify.com/intl-ja/artist/4HMsmtz30nAdFyz0aWetHl' },
  { label: 'Apple Music', url: 'https://music.apple.com/jp/artist/nowa/1878928538' },
  { label: 'TikTok', url: 'https://www.tiktok.com/@nowa_music' },
  { label: 'Instagram', url: 'https://www.instagram.com/nowamusicjp' },
];

export const CONTACT_EMAIL = '';

/** URLが入っているものだけ返す。 */
export const activeLinks = () => LINKS.filter((link) => link.url);
