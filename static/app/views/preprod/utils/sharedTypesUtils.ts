import type {Platform} from 'sentry/views/preprod/types/sharedTypes';

export function validatedPlatform(platform: unknown): Platform | undefined {
  if (
    platform === 'apple' ||
    platform === 'ios' ||
    platform === 'android' ||
    platform === 'macos'
  ) {
    return platform;
  }
  return undefined;
}
