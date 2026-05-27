import {t} from 'sentry/locale';
import {SpanFields} from 'sentry/views/insights/types';
import type {SpanProperty} from 'sentry/views/insights/types';

export const MODULE_TITLE = t('Web Vitals');
export const BASE_URL = 'pageloads';
export const DATA_TYPE = t('Web Vitals');
export const DATA_TYPE_PLURAL = t('Web Vitals');

export const MODULE_DOC_LINK =
  'https://docs.sentry.io/product/insights/frontend/web-vitals/';

export const DEFAULT_QUERY_FILTER =
  'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""]';

export const MODULE_FEATURES = ['insight-modules'];

export const FIELD_ALIASES = {
  [`p75(${SpanFields.BROWSER_WEB_VITAL_LCP_VALUE})`]: 'LCP',
  [`p75(${SpanFields.BROWSER_WEB_VITAL_FCP_VALUE})`]: 'FCP',
  [`p75(${SpanFields.BROWSER_WEB_VITAL_INP_VALUE})`]: 'INP',
  [`p75(${SpanFields.BROWSER_WEB_VITAL_CLS_VALUE})`]: 'CLS',
  [`p75(${SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE})`]: 'TTFB',
} satisfies Partial<Record<SpanProperty, string>>;
