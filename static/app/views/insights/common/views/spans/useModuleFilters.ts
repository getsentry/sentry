import pick from 'lodash/pick';

import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField, type SubregionCode} from 'sentry/views/insights/types';

export type ModuleFilters = {
  [SpanMetricsField.SPAN_ACTION]?: string;
  [SpanMetricsField.SPAN_DOMAIN]?: string;
  [SpanMetricsField.SPAN_GROUP]?: string;
  [SpanMetricsField.SPAN_OP]?: string;
  [SpanMetricsField.USER_GEO_SUBREGION]?: SubregionCode[];
};

export const useModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  const filters = pick(location.query, [
    SpanMetricsField.SPAN_ACTION,
    SpanMetricsField.SPAN_DOMAIN,
    SpanMetricsField.SPAN_OP,
    SpanMetricsField.SPAN_GROUP,
  ]);

  const subregions = decodeList(
    location.query[SpanMetricsField.USER_GEO_SUBREGION]
  ) as SubregionCode[];
  if (subregions.length) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    filters[SpanMetricsField.USER_GEO_SUBREGION] = subregions;
  }

  return filters;
};
