import {isWebpackChunkLoadingError} from 'app/utils';

const MAX_RETRIES = 2;

export default async function retryableImport<T>(
  fn: () => Promise<{default: T}>
): Promise<T> {
  let retries = 0;
  const tryLoad = async () => {
    try {
      const module = await fn();
      return module.default || module;
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
