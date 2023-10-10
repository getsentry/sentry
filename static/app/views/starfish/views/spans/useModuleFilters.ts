import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField} from 'sentry/views/starfish/types';

export type ModuleFilters = {
  [SpanMetricsField.SPAN_ACTION]?: string;
  [SpanMetricsField.SPAN_DOMAIN]?: string;
  [SpanMetricsField.SPAN_GROUP]?: string;
  [SpanMetricsField.SPAN_OP]?: string;
};

export const useModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    SpanMetricsField.SPAN_ACTION,
    SpanMetricsField.SPAN_DOMAIN,
    SpanMetricsField.SPAN_OP,
    SpanMetricsField.SPAN_GROUP,
  ]);
};
