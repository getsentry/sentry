import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {ValidSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {EMPTY_OPTION_VALUE} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

const {
  SPAN_DOMAIN,
  SPAN_GROUP,
  SPAN_DESCRIPTION,
  SPAN_OP,
  SPAN_SELF_TIME,
  RESOURCE_RENDER_BLOCKING_STATUS,
  HTTP_RESPONSE_CONTENT_LENGTH,
  PROJECT_ID,
} = SpanMetricsField;

type Props = {
  sort: ValidSort;
  defaultResourceTypes?: string[];
  limit?: number;
  query?: string;
};

export const DEFAULT_RESOURCE_FILTERS = ['!span.description:"browser-extension://*"'];

export const useResourcesQuery = ({sort, defaultResourceTypes, query, limit}: Props) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const resourceFilters = useResourceModuleFilters();
  const {slug: orgSlug} = useOrganization();

  const queryConditions = [
    ...(!query
      ? [
          ...DEFAULT_RESOURCE_FILTERS,
          ...(resourceFilters.transaction
            ? [`transaction:"${resourceFilters.transaction}"`]
            : []),
          ...getResourceTypeFilter(resourceFilters[SPAN_OP], defaultResourceTypes),
          ...getDomainFilter(resourceFilters[SPAN_DOMAIN]),
          ...(resourceFilters['resource.render_blocking_status']
            ? [
                `resource.render_blocking_status:${resourceFilters['resource.render_blocking_status']}`,
              ]
            : [`!resource.render_blocking_status:blocking`]),
        ]
      : []),
    query,
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
        SPAN_DOMAIN,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        'project.id',
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

  const result = useDiscoverQuery({
    eventView,
    limit: limit ?? 100,
    location,
    orgSlug,
    options: {
      refetchOnWindowFocus: false,
    },
  });

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
    [PROJECT_ID]: row[PROJECT_ID] as number,
    [`avg(http.response_content_length)`]: row[
      `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`
    ] as number,
    ['count_unique(transaction)']: row['count_unique(transaction)'] as number,
  }));

  return {...result, data: data || []};
};

export const getDomainFilter = (selectedDomain: string | undefined) => {
  if (!selectedDomain) {
    return [];
  }
 
  if (selectedDomain === EMPTY_OPTION_VALUE) {
    return [`!has:${SPAN_DOMAIN}`];
  }
  
  return [`${SPAN_DOMAIN}:${selectedDomain}`];
};

export const getResourceTypeFilter = (
  selectedSpanOp: string | undefined,
  defaultResourceTypes: string[] | undefined
) => {
  let resourceFilter: string[] = [`${SPAN_OP}:resource.*`];
  if (selectedSpanOp) {
    resourceFilter = [`${SPAN_OP}:${selectedSpanOp}`];
  } else if (defaultResourceTypes) {
    resourceFilter = [`${SPAN_OP}:[${defaultResourceTypes.join(',')}]`];
  }
  return resourceFilter;
};
