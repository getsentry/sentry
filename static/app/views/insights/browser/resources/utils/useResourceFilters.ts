import {parseAsString, useQueryStates} from 'nuqs';

import type {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import type {SubregionCode} from 'sentry/views/insights/types';

// TODO - we should probably just use SpanMetricsField here
enum BrowserStarfishFields {
  SPAN_OP = 'span.op',
  TRANSACTION = 'transaction',
  SPAN_DOMAIN = 'span.domain',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  USER_GEO_SUBREGION = 'user.geo.subregion',
}

export type ModuleFilters = {
  [BrowserStarfishFields.RESOURCE_RENDER_BLOCKING_STATUS]:
    | ''
    | 'non-blocking'
    | 'blocking'
    | '!blocking';
  [BrowserStarfishFields.SPAN_DOMAIN]?: string;
  [BrowserStarfishFields.SPAN_OP]?: ResourceSpanOps;
  [BrowserStarfishFields.TRANSACTION]?: string;
  [BrowserStarfishFields.USER_GEO_SUBREGION]?: SubregionCode[];
};

const resourceModuleFilterParsers = {[BrowserStarfishFields.SPAN_OP]: parseAsString};

export const useResourceModuleFilters = () => {
  const [filters] = useQueryStates(resourceModuleFilterParsers);
  return filters;
};
