/**
 * Whether Pride-themed UI (e.g. the boot splash and the Command+K splash modal)
 * should be shown. Currently gated to Pride month (June).
 *
 * Note: the boot splash in `static/index.ejs` inlines this same check because it
 * runs before the app bundle loads and cannot import from here.
 */
export function showPrideElements(now: Date = new Date()): boolean {
  return now.getMonth() === 5;
}
