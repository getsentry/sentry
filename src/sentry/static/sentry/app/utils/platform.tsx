export function isNativePlatform(platform: string | undefined): boolean {
  switch (platform) {
    case 'cocoa':
    case 'objc':
    case 'native':
    case 'swift':
    case 'c':
      return true;
    default:
      return false;
  }
}
