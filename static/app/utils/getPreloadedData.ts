export async function getPreloadedDataPromise(
  name: string,
  slug: string,
  fallback: () => Promise<any>,
  usePreload?: boolean
) {
  try {
    const data = (window as any).__sentry_preload;
    if (
      !usePreload ||
      !data ||
      !data.orgSlug ||
      data.orgSlug.toLowerCase() !== slug.toLowerCase() ||
      !data[name] ||
      !data[name].then
    ) {
      return await fallback();
    }
    const result = await data[name].catch(fallback);
    if (!result) {
      return await fallback();
    }
    return await result;
  } catch (_) {
    //
  }
  return await fallback();
}
