import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField, type SubregionCode} from 'sentry/views/insights/types';

const {HTTP_RESPONSE_CONTENT_LENGTH, RESOURCE_RENDER_BLOCKING_STATUS} = SpanMetricsField;

export const useResourcePagesQuery = (
  groupId: string,
  {
    sort,
    cursor,
    subregions,
    renderBlockingStatus,
  }: {
    sort: Sort;
    cursor?: string;
    renderBlockingStatus?: string;
    subregions?: SubregionCode[];
  }
) => {
  const search = new MutableSearch('');
  const filters = {
    'span.group': groupId,
    ...(renderBlockingStatus
      ? {[RESOURCE_RENDER_BLOCKING_STATUS]: renderBlockingStatus}
      : {}),
    ...(subregions
      ? {[SpanMetricsField.USER_GEO_SUBREGION]: `[${subregions.join(',')}]`}
      : {}),
  };

  const sorts = [sort];

  const finalSorts: Sort[] = sorts?.length
    ? sorts
    : [
        {
          field: 'epm()',
          kind: 'desc',
        },
      ];

  Object.entries(filters).forEach(([key, value]) => {
    if (!defined(value)) {
      return;
    }

    if (Array.isArray(value)) {
      search.addFilterValues(key, value);
    } else {
      search.addFilterValue(key, value);
    }
  });

  return useSpanMetrics(
    {
      cursor,
      limit: 25,
      sorts: finalSorts,
      search,
      fields: [
        'transaction',
        'epm()',
        `avg(span.self_time)`,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        RESOURCE_RENDER_BLOCKING_STATUS,
      ],
    },
    'api.insights.resource-page-query'
  );
};
