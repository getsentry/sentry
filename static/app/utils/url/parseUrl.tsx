export default function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
