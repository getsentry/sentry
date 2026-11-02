import {t} from 'sentry/locale';
import type {OrganizationFeature} from 'sentry/types/featureFlags.generated';

export const MODULE_TITLE = t('App Starts');
export const BASE_URL = 'app-startup';
export const DATA_TYPE = t('App Start');
export const DATA_TYPE_PLURAL = t('App Starts');

export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/mobile/app-starts/';

export const MODULE_FEATURES: OrganizationFeature[] = ['insight-modules'];
