import {t} from 'sentry/locale';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {SpanFields} from 'sentry/views/insights/types';

export const DASHBOARD_TITLE = t('Outbound API Requests');
export const DETAILS_DASHBOARD_TITLE = t('Domain Details');

export const DASHBOARD_DESCRIPTION = t(
  'Outgoing HTTP requests by domain: response times and 3xx/4xx/5xx rates.'
);
export const DETAILS_DASHBOARD_DESCRIPTION = t(
  'Throughput, duration, and response codes for a single domain.'
);

export const THROUGHPUT_TEXT = `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`;
export const AVERAGE_DURATION_TEXT = t('Average Duration');
export const RESPONSE_CODES_TEXT = t('Response Codes (3XX, 4XX, 5XX)');

export const BASE_FILTERS = {
  [SpanFields.SPAN_OP]: 'http.client',
};
