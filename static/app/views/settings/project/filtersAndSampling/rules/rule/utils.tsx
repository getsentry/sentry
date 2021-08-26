import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {DynamicSamplingInnerName} from 'app/types/dynamicSampling';

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
      return t('Legacy Browsers');
    case DynamicSamplingInnerName.EVENT_TRANSACTION:
    case DynamicSamplingInnerName.TRACE_TRANSACTION:
      return t('Transactions');
    case DynamicSamplingInnerName.EVENT_ERROR_MESSAGES:
      return t('Error Messages');
    default: {
      Sentry.captureException(new Error('Unknown dynamic sampling condition inner name'));
      return null; // this shall never happen
    }
  }
}
