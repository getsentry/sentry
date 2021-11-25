import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import {DynamicSamplingInnerName, LegacyBrowser} from 'sentry/types/dynamicSampling';

// TODO(PRISCILA): Update this link as soon as we have one for dynamic sampling
export const DYNAMIC_SAMPLING_DOC_LINK =
  'https://docs.sentry.io/product/data-management-settings/filtering/';

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

export function getInnerNameLabel(name: DynamicSamplingInnerName) {
  switch (name) {
    case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
    case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
      return t('Environment');
    case DynamicSamplingInnerName.TRACE_RELEASE:
    case DynamicSamplingInnerName.EVENT_RELEASE:
      return t('Release');
    case DynamicSamplingInnerName.EVENT_USER_ID:
    case DynamicSamplingInnerName.TRACE_USER_ID:
      return t('User Id');
    case DynamicSamplingInnerName.EVENT_USER_SEGMENT:
    case DynamicSamplingInnerName.TRACE_USER_SEGMENT:
      return t('User Segment');
    case DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS:
      return t('Browser Extensions');
    case DynamicSamplingInnerName.EVENT_LOCALHOST:
      return t('Localhost');
    case DynamicSamplingInnerName.EVENT_WEB_CRAWLERS:
      return t('Web Crawlers');
    case DynamicSamplingInnerName.EVENT_LEGACY_BROWSER:
      return t('Legacy Browser');
    case DynamicSamplingInnerName.EVENT_TRANSACTION:
    case DynamicSamplingInnerName.TRACE_TRANSACTION:
      return t('Transaction');
    case DynamicSamplingInnerName.EVENT_ERROR_MESSAGES:
      return t('Error Message');
    case DynamicSamplingInnerName.EVENT_CSP:
      return t('Content Security Policy');
    case DynamicSamplingInnerName.EVENT_IP_ADDRESSES:
      return t('IP Address');
    default: {
      Sentry.captureException(new Error('Unknown dynamic sampling condition inner name'));
      return null; // this shall never happen
    }
  }
}
