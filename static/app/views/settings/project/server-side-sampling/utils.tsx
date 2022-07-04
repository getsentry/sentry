import {t} from 'sentry/locale';
import {LegacyBrowser, SamplingInnerName} from 'sentry/types/sampling';

// TODO: Update this link as soon as we have one for sampling
export const SERVER_SIDE_SAMPLING_DOC_LINK =
  'https://docs.sentry.io/product/data-management-settings/filtering/';

const CUSTOM_TAG_PREFIX = 'event.tags.';

export function stripCustomTagPrefix(name: string): string {
  if (name.startsWith(CUSTOM_TAG_PREFIX)) {
    return name.replace(CUSTOM_TAG_PREFIX, '');
  }

  return name;
}

export const LEGACY_BROWSER_LIST = {
  [LegacyBrowser.IE_PRE_9]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer version 8 and lower'),
  },
  [LegacyBrowser.IE9]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer version 9'),
  },
  [LegacyBrowser.IE10]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer version 10'),
  },
  [LegacyBrowser.IE11]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer version 11'),
  },
  [LegacyBrowser.SAFARI_PRE_6]: {
    icon: 'safari',
    title: t('Safari version 5 and lower'),
  },
  [LegacyBrowser.OPERA_PRE_15]: {
    icon: 'opera',
    title: t('Opera version 14 and lower'),
  },
  [LegacyBrowser.OPERA_MINI_PRE_8]: {
    icon: 'opera',
    title: t('Opera Mini version 8 and lower'),
  },
  [LegacyBrowser.ANDROID_PRE_4]: {
    icon: 'android',
    title: t('Android version 3 and lower'),
  },
};

export function getInnerNameLabel(name: SamplingInnerName | string) {
  switch (name) {
    case SamplingInnerName.TRACE_ENVIRONMENT:
    case SamplingInnerName.EVENT_ENVIRONMENT:
      return t('Environment');
    case SamplingInnerName.TRACE_RELEASE:
    case SamplingInnerName.EVENT_RELEASE:
      return t('Release');
    case SamplingInnerName.EVENT_USER_ID:
    case SamplingInnerName.TRACE_USER_ID:
      return t('User Id');
    case SamplingInnerName.EVENT_USER_SEGMENT:
    case SamplingInnerName.TRACE_USER_SEGMENT:
      return t('User Segment');
    case SamplingInnerName.EVENT_LOCALHOST:
      return t('Localhost');
    case SamplingInnerName.EVENT_WEB_CRAWLERS:
      return t('Web Crawlers');
    case SamplingInnerName.EVENT_LEGACY_BROWSER:
      return t('Legacy Browser');
    case SamplingInnerName.EVENT_TRANSACTION:
    case SamplingInnerName.TRACE_TRANSACTION:
      return t('Transaction');
    case SamplingInnerName.EVENT_CSP:
      return t('Content Security Policy');
    case SamplingInnerName.EVENT_IP_ADDRESSES:
      return t('IP Address');
    case SamplingInnerName.EVENT_OS_NAME:
      return t('OS Name');
    case SamplingInnerName.EVENT_OS_VERSION:
      return t('OS Version');
    case SamplingInnerName.EVENT_DEVICE_FAMILY:
      return t('Device Family');
    case SamplingInnerName.EVENT_DEVICE_NAME:
      return t('Device Name');
    case SamplingInnerName.EVENT_CUSTOM_TAG:
      return t('Add Custom Tag');

    default:
      return `${stripCustomTagPrefix(name)} - ${t('Custom')}`;
  }
}
