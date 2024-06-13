import type {PlatformIntegration} from 'sentry/types/project';

export function getPlatformPath(platform: PlatformIntegration) {
  // TODO: This will be removed once we no longer rely on sentry-docs to load platform icons
  if (platform.type === 'framework') {
    switch (platform.id) {
      case 'capacitor':
        return `capacitor/capacitor`;
      case 'ionic':
        return `ionic/ionic`;
      case 'dart':
        return `dart/dart`;
      case 'android':
        return `android/android`;
      case 'flutter':
        return `flutter/flutter`;
      case 'unreal':
        return `unreal/unreal`;
      case 'unity':
        return `unity/unity`;
      case 'minidump':
        return `minidump/minidump`;
      case 'native-qt':
        return `native/native-qt`;
      default:
        return platform.id.replace(`${platform.language}-`, `${platform.language}/`);
    }
  }

  switch (platform.id) {
    case 'python-celery':
      return `python/celery`;
    case 'python-rq':
      return `python/rq`;
    case 'python-pymongo':
      return `python/mongo`;
    default:
      return `${platform.language}/${platform.id}`;
  }
}
