import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const BASE_FILTERS = {
  [SpanFields.SPAN_CATEGORY]: ModuleName.DB,
  has: SpanFields.NORMALIZED_DESCRIPTION,
};

export const BASE_FILTER_STRING =
  MutableSearch.fromQueryObject(BASE_FILTERS).formatString();
