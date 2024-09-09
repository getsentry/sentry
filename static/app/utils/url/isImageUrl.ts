/**
 * Checks if a URL points to an image file based on common image extensions.
 * The URL is trimmed and checked for extensions listed in the imageExtensionsPattern.
 *
 * @param url - The URL to check.
 * @returns True if the URL ends with an image extension; otherwise, false.
 */
export function isImageUrl(url: string): boolean {
  const imageExtensionsPattern = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i;
  return imageExtensionsPattern.test(url.trim());
}
