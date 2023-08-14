import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsFields} from 'sentry/views/starfish/types';

export type ModuleFilters = {
  [SpanMetricsFields.SPAN_ACTION]?: string;
  [SpanMetricsFields.SPAN_DOMAIN]?: string;
  [SpanMetricsFields.SPAN_GROUP]?: string;
  [SpanMetricsFields.SPAN_OP]?: string;
};

export const useModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    SpanMetricsFields.SPAN_ACTION,
    SpanMetricsFields.SPAN_DOMAIN,
    SpanMetricsFields.SPAN_OP,
    SpanMetricsFields.SPAN_GROUP,
  ]);
};
