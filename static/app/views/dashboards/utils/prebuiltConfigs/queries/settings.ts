import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

export const DASHBOARD_TITLE = t('Queries');
export const DETAILS_DASHBOARD_TITLE = t('Query Details');

export const QUERIES_PER_MINUTE_TEXT = t('Queries Per Minute');
export const AVERAGE_DURATION_TEXT = t('Average Duration');

const BASE_FILTERS = {
  [SpanFields.SPAN_CATEGORY]: ModuleName.DB,
  has: SpanFields.NORMALIZED_DESCRIPTION,
};

export const BASE_FILTER_STRING =
  MutableSearch.fromQueryObject(BASE_FILTERS).formatString();
