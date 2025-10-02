export function isValidUrl(str: any): boolean {
  try {
    return !!new URL(str);
  } catch {
    return false;
  }
}
