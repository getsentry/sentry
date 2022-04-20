export default function getURLPathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}
