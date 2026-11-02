import {t} from 'sentry/locale';
import type {OrganizationFeature} from 'sentry/types/featureFlags.generated';

export const MODULE_TITLE = t('Mobile Vitals');

export const BASE_URL = 'mobile-vitals';

export const MODULE_DESCRIPTION = t(
  'Get insights into key performance metrics of your mobile app.'
);

export const MODULE_FEATURE: OrganizationFeature = 'insight-modules';

export const DATA_TYPE = t('Mobile Vitals');
export const DATA_TYPE_PLURAL = t('Mobile Vitals');

export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/mobile/mobile-vitals/';
