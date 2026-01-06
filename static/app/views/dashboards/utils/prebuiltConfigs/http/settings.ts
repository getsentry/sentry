import {t} from 'sentry/locale';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {SpanFields} from 'sentry/views/insights/types';

export const DASHBOARD_TITLE = t('Outbound API Requests');

export const THROUGHPUT_TEXT = `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`;
export const AVERAGE_DURATION_TEXT = t('Average Duration');
export const RESPONSE_CODES_TEXT = t('Response Codes (3XX, 4XX, 5XX)');

export const BASE_FILTERS = {
  [SpanFields.SPAN_OP]: 'http.client',
};
