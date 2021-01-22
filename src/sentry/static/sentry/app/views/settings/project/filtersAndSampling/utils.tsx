import {PlatformKey} from 'app/data/platformCategories';

export function getPlatformDocLink(platform?: PlatformKey) {
  switch (platform) {
    case 'rust':
      return 'https://docs.sentry.io/platforms/rust/configuration/filtering/';
    case 'javascript':
      return 'https://docs.sentry.io/platforms/javascript/configuration/filtering/#sampling-error-events';
    case 'ruby':
      return 'https://docs.sentry.io/platforms/ruby/configuration/filtering/';
    default:
      return undefined;
  }
}
