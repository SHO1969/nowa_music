/**
 * Googleアナリティクス（GA4）の設定。
 * 測定IDはブラウザ側のコードに必ず出るものなので、秘密情報ではない。
 * 計測を止めたいときは MEASUREMENT_ID を空文字にする。
 */
export const MEASUREMENT_ID = 'G-1TMW24TDHY';

/**
 * 計測を有効にするホスト名。
 * astro preview は本番ビルドをそのまま配信するため、ビルド種別だけでは
 * ローカル確認のアクセスを除外できない。GitHub Pagesの
 * sho1969.github.io 経由のアクセスも同様に混ざるので、
 * 実際のドメインで見られたときだけ記録する。
 */
export const ANALYTICS_HOSTNAME = 'nowajp.com';

/**
 * 計測タグを出力すべきか。
 * 本番ビルドのときだけ出す。ローカルでの確認を数字に混ぜないため。
 */
export function isAnalyticsEnabled(isProduction) {
  return Boolean(MEASUREMENT_ID) && isProduction === true;
}
