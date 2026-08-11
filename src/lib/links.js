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
