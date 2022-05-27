import {isWebpackChunkLoadingError} from 'sentry/utils';

const MAX_RETRIES = 2;

export default async function retryableImport<T>(
  fn: () => Promise<{default: T}>
): Promise<{default: T}> {
  let retries = 0;
  const tryLoad = async () => {
    try {
      return fn();
    } catch (err) {
      if (isWebpackChunkLoadingError(err) && retries < MAX_RETRIES) {
        retries++;
        return tryLoad();
      }

      throw err;
    }
  };

  return tryLoad();
}
