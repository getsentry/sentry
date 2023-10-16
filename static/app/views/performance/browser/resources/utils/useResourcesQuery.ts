import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {ValidSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const {
  SPAN_DOMAIN,
  SPAN_GROUP,
  SPAN_DESCRIPTION,
  SPAN_OP,
  SPAN_SELF_TIME,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = SpanMetricsField;

export const useResourcesQuery = ({sort}: {sort: ValidSort}) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const resourceFilters = useResourceModuleFilters();
  const {slug: orgSlug} = useOrganization();
  const queryConditions = [
    `${SPAN_OP}:${resourceFilters.type || 'resource.*'}`,
    ...(resourceFilters.transaction
      ? [`transaction:"${resourceFilters.transaction}"`]
      : []),
    ...(resourceFilters[SPAN_DOMAIN]
      ? [`${SPAN_DOMAIN}:${resourceFilters[SPAN_DOMAIN]}`]
      : []),
    ...(resourceFilters['resource.render_blocking_status']
      ? [
          `resource.render_blocking_status:${resourceFilters['resource.render_blocking_status']}`,
        ]
      : []),
  ];

  // TODO - we should be using metrics data here
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        SPAN_DESCRIPTION,
        SPAN_OP,
        'count()',
        `avg(${SPAN_SELF_TIME})`,
        'spm()',
        SPAN_GROUP,
        RESOURCE_RENDER_BLOCKING_STATUS,
        SPAN_DOMAIN,
      ],
      name: 'Resource module - resource table',
      query: queryConditions.join(' '),
      orderby: '-count',
      version: 2,
      dataset: DiscoverDatasets.SPANS_METRICS,
    },
    pageFilters.selection
  );

  if (sort) {
    eventView.sorts = [sort];
  }

  const result = useDiscoverQuery({eventView, limit: 100, location, orgSlug});

  const data = result?.data?.data.map(row => ({
    [SPAN_OP]: row[SPAN_OP].toString() as `resource.${string}`,
    [SPAN_DESCRIPTION]: row[SPAN_DESCRIPTION].toString(),
    ['avg(span.self_time)']: row[`avg(${SPAN_SELF_TIME})`] as number,
    'count()': row['count()'] as number,
    'spm()': row['spm()'] as number,
    [SPAN_GROUP]: row[SPAN_GROUP].toString(),
    [RESOURCE_RENDER_BLOCKING_STATUS]: row[RESOURCE_RENDER_BLOCKING_STATUS] as
      | ''
      | 'non-blocking'
      | 'blocking',
    [SPAN_DOMAIN]: row[SPAN_DOMAIN][0]?.toString(),
  }));

  return {...result, data: data || []};
};
