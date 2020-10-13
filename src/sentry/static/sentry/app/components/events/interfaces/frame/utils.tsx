import {PlatformType} from 'app/types';

export function trimPackage(pkg: string) {
  const pieces = pkg.split(/^([a-z]:\\|\\\\)/i.test(pkg) ? '\\' : '/');
  const filename = pieces[pieces.length - 1] || pieces[pieces.length - 2] || pkg;
  return filename.replace(/\.(dylib|so|a|dll|exe)$/, '');
}

export function getPlatform(dataPlatform: PlatformType, platform: string) {
  // prioritize the frame platform but fall back to the platform
  // of the stacktrace / exception
  return dataPlatform || platform;
}
