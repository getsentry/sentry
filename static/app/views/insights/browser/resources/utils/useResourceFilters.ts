import pick from 'lodash/pick';

import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import type {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import type {SubregionCode} from 'sentry/views/insights/types';

// TODO - we should probably just use SpanMetricsField here
export enum BrowserStarfishFields {
  SPAN_OP = 'span.op',
  TRANSACTION = 'transaction',
  SPAN_DOMAIN = 'span.domain',
  GROUP_ID = 'groupId',
  DESCRIPTION = 'description',
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
  [BrowserStarfishFields.SPAN_DOMAIN]?: string;
  [BrowserStarfishFields.USER_GEO_SUBREGION]?: SubregionCode[];
};

export const useResourceModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  const filters = pick(location.query, [
    BrowserStarfishFields.SPAN_DOMAIN,
    BrowserStarfishFields.SPAN_OP,
    BrowserStarfishFields.TRANSACTION,
    BrowserStarfishFields.GROUP_ID,
    BrowserStarfishFields.DESCRIPTION,
    BrowserStarfishFields.RESOURCE_RENDER_BLOCKING_STATUS,
  ]);

  const subregions = decodeList(
    location.query[BrowserStarfishFields.USER_GEO_SUBREGION]
  ) as SubregionCode[];
  if (subregions.length) {
    filters[BrowserStarfishFields.USER_GEO_SUBREGION] = subregions;
  }

  return filters;
};
