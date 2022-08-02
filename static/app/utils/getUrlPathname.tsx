export default function getUrlPathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}
