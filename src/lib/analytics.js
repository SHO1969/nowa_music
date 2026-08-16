/**
 * Googleアナリティクス（GA4）の設定。
 * 測定IDはブラウザ側のコードに必ず出るものなので、秘密情報ではない。
 * 計測を止めたいときは MEASUREMENT_ID を空文字にする。
 */
export const MEASUREMENT_ID = 'G-1TMW24TDHY';

/**
 * 計測タグを出力すべきか。
 * 本番ビルドのときだけ出す。ローカルでの確認を数字に混ぜないため。
 */
export function isAnalyticsEnabled(isProduction) {
  return Boolean(MEASUREMENT_ID) && isProduction === true;
}
