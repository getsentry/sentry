import {t} from 'sentry/locale';
import {RateUnit} from 'sentry/utils/discover/fields';
import {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';

export const MODULE_TITLE = t('Assets');
export const DATA_TYPE = t('Asset');
export const DATA_TYPE_PLURAL = t('Assets');
export const BASE_URL = 'assets'; // Name of the data shown (singular)
export const MODULE_DESCRIPTION = t(
  'Find large and slow-to-load resources used by your application and understand their impact on page performance.'
);

export const RESOURCE_THROUGHPUT_UNIT = RateUnit.PER_MINUTE;

export const DEFAULT_RESOURCE_TYPES = [
  ResourceSpanOps.SCRIPT,
  ResourceSpanOps.CSS,
  ResourceSpanOps.FONT,
  ResourceSpanOps.IMAGE,
];

export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/insights/frontend/assets/';

export const MODULE_FEATURES = ['insights-initial-modules'];
