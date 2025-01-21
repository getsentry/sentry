import type {ApiResult} from 'sentry/api';

export async function getPreloadedDataPromise(
  name: 'organization' | 'projects' | 'teams',
  slug: string,
  fallback: () => Promise<ApiResult>,
  usePreload?: boolean
): Promise<ApiResult> {
  const data = window.__sentry_preload;
  /**
   * Save the fallback promise to `__sentry_preload` to allow the sudo modal to wait
   * for the promise to resolve
   */
  const wrappedFallback = () => {
    const fallbackAttribute = `${name}_fallback` as const;
    const promise = fallback();
    if (data) {
      data[fallbackAttribute] = promise;
    }
    return promise;
  };

  try {
    if (
      !usePreload ||
      !data ||
      !data.orgSlug ||
      data.orgSlug.toLowerCase() !== slug.toLowerCase() ||
      !data[name] ||
      !data[name].then
    ) {
      return await wrappedFallback();
    }
    const result = await data[name].catch(() => null);
    if (!result) {
      return await wrappedFallback();
    }
    return await result;
  } catch (_) {
    //
  }
  return await wrappedFallback();
}
