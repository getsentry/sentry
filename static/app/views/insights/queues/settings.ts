import {t} from 'sentry/locale';
import type {OrganizationFeature} from 'sentry/types/featureFlags.generated';

export const MODULE_TITLE = t('Queues');
export const BASE_URL = 'queues';
export const DATA_TYPE = t('Queue');
export const DATA_TYPE_PLURAL = t('Queues');

export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/backend/queue-monitoring/';

export const MODULE_FEATURES: OrganizationFeature[] = ['insight-modules'];
