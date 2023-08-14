import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsFields} from 'sentry/views/starfish/types';

type Query = {
  'span.action': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
};

export const useModuleFilters = () => {
  const location = useLocation<Query>();

  return pick(location.query, [
    SpanMetricsFields.SPAN_ACTION,
    SpanMetricsFields.SPAN_DOMAIN,
    SpanMetricsFields.SPAN_OP,
    SpanMetricsFields.SPAN_GROUP,
  ]);
};
