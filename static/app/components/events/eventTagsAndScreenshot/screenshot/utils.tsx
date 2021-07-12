import {PlatformType} from 'app/types';

export const platformsMobileWithAttachmentsFeature = ['android', 'apple'] as const;

const platformsWithAttachmentsFeature = [
  'dotnet',
  'javascript',
  'native',
  ...platformsMobileWithAttachmentsFeature,
] as const;

type DocPlatform = typeof platformsWithAttachmentsFeature[number];

function validDocPlatform(platform: any): platform is DocPlatform {
  if (!platform) {
    return false;
  }
  return platformsWithAttachmentsFeature.includes(platform);
}

export function getConfigureAttachmentsDocsLink(platform?: PlatformType) {
  if (!platform || !validDocPlatform(platform)) {
    return undefined;
  }

  return `https://docs.sentry.io/platforms/${platform}/enriching-events/attachments/`;
}
