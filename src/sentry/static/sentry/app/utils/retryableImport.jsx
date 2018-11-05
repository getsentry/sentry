const MAX_RETRIES = 2;

export default async function retryableImport(fn) {
  let retries = 0;
  const tryLoad = async () => {
    try {
      const module = await fn();
      return module.default || module;
    } catch (err) {
      const isWebpackLoadingError =
        err &&
        typeof err.message === 'string' &&
        err.message.toLowerCase().includes('loading chunk');

      if (isWebpackLoadingError && retries < MAX_RETRIES) {
        retries++;
        return tryLoad();
      }

      throw err;
    }
  };

  return tryLoad();
}
