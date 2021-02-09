export function getPreloadedDataPromise(
  name: string,
  slug: string,
  fallback,
  isInitialFetch?: boolean
) {
  const data = (window as any).__sentry_preload;
  if (
    !isInitialFetch ||
    !data ||
    data.orgSlug.toLowerCase() !== slug.toLowerCase() ||
    !data[name].then
  ) {
    return fallback();
  }
  return data[name].catch(fallback);
}
