import {t} from 'sentry/locale';

export const MODULE_TITLE = t('Web Vitals');
export const BASE_URL = 'browser/pageloads';
export const DATA_TYPE = t('Web Vitals');
export const DATA_TYPE_PLURAL = t('Web Vitals');

export const MODULE_DESCRIPTION = t(
  'Measure the quality of real user experience in your web applications using industry standard quality signals.'
);
export const MODULE_DOC_LINK = 'https://docs.sentry.io/product/insights/web-vitals/';

export const DEFAULT_QUERY_FILTER =
  'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,""] !transaction:"<< unparameterized >>"';
