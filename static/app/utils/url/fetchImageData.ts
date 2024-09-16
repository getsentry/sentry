/**
 * Fetches and provides an HTMLImageElement from a given URL.
 * It validates the URL format before attempting to load the image.
 *
 * @param {string} url - The URL of the image to fetch and inspect.
 * @returns {Promise<HTMLImageElement>}
 * A promise that resolves to the HTMLImageElement object representing the loaded image.
 *
 * If the URL is invalid or the image fails to load, the promise is rejected with an error.
 */
export function fetchImageData(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let isCanceled = false;

    img.onload = () => {
      if (!isCanceled) {
        resolve(img);
      }
    };

    img.onerror = error => {
      if (!isCanceled) {
        reject(error);
      }
    };

    img.src = url;

    return () => {
      isCanceled = true;
      img.onload = null;
      img.onerror = null;
    };
  });
}
