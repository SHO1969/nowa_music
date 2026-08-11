/** 動画/再生リストのIDから、モーダルに入れる埋め込みURLを作る。 */
export function embedUrl(kind, id) {
  if (!id) return '';
  if (kind === 'video') return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  if (kind === 'playlist') return `https://www.youtube.com/embed/videoseries?list=${id}&autoplay=1&rel=0`;
  return '';
}
