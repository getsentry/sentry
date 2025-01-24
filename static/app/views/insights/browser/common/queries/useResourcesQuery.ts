import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  FONT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
} from 'sentry/views/insights/browser/resources/constants';
import {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import type {ModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import type {ValidSort} from 'sentry/views/insights/browser/resources/utils/useResourceSort';
import {SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

const {
  SPAN_DOMAIN,
  SPAN_GROUP,
  SPAN_DESCRIPTION,
  SPAN_OP,
  SPAN_SELF_TIME,
  RESOURCE_RENDER_BLOCKING_STATUS,
  HTTP_RESPONSE_CONTENT_LENGTH,
  PROJECT_ID,
  FILE_EXTENSION,
  USER_GEO_SUBREGION,
} = SpanMetricsField;

const {TIME_SPENT_PERCENTAGE} = SpanFunction;

type Props = {
  referrer: string;
  sort: ValidSort;
  cursor?: string;
  defaultResourceTypes?: string[];
  limit?: number;
  query?: string;
};

export const DEFAULT_RESOURCE_FILTERS = ['!span.description:"browser-extension://*"'];

export const getResourcesEventViewQuery = (
  resourceFilters: Partial<ModuleFilters>,
  defaultResourceTypes: string[] | undefined
): string[] => {
  return [
    ...DEFAULT_RESOURCE_FILTERS,
    ...(resourceFilters.transaction
      ? [`transaction:"${resourceFilters.transaction}"`]
      : []),
    ...(resourceFilters[USER_GEO_SUBREGION]
      ? [`user.geo.subregion:[${resourceFilters[USER_GEO_SUBREGION]}]`]
      : []),
    ...getDomainFilter(resourceFilters[SPAN_DOMAIN]),
    ...(resourceFilters[RESOURCE_RENDER_BLOCKING_STATUS]
      ? [
          `${RESOURCE_RENDER_BLOCKING_STATUS}:${resourceFilters[RESOURCE_RENDER_BLOCKING_STATUS]}`,
        ]
      : []),
    ...getResourceTypeFilter(resourceFilters[SPAN_OP], defaultResourceTypes),
  ];
};

export const useResourcesQuery = ({
  sort,
  defaultResourceTypes,
  query,
  limit,
  cursor,
  referrer,
}: Props) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const resourceFilters = useResourceModuleFilters();
  const {slug: orgSlug} = useOrganization();

  const queryConditions = [
    ...(!query ? getResourcesEventViewQuery(resourceFilters, defaultResourceTypes) : []),
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
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        'project.id',
        `${TIME_SPENT_PERCENTAGE}()`,
        `sum(${SPAN_SELF_TIME})`,
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
    cursor,
    referrer,
  });

  const data = result?.data?.data.map(row => ({
    [SPAN_OP]: row[SPAN_OP]!.toString() as `resource.${string}`,
    [SPAN_DESCRIPTION]: row[SPAN_DESCRIPTION]!.toString(),
    ['avg(span.self_time)']: row[`avg(${SPAN_SELF_TIME})`] as number,
    'count()': row['count()'] as number,
    'spm()': row['spm()'] as number,
    [SPAN_GROUP]: row[SPAN_GROUP]!.toString(),
    [PROJECT_ID]: row[PROJECT_ID] as number,
    [`avg(http.response_content_length)`]: row[
      `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`
    ] as number,
    [`time_spent_percentage()`]: row[`${TIME_SPENT_PERCENTAGE}()`] as number,
    ['count_unique(transaction)']: row['count_unique(transaction)'] as number,
    [`sum(span.self_time)`]: row[`sum(${SPAN_SELF_TIME})`] as number,
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

  return [`${SPAN_DOMAIN}:"${selectedDomain}"`];
};

const SPAN_OP_FILTER = {
  [ResourceSpanOps.SCRIPT]: [`${SPAN_OP}:${ResourceSpanOps.SCRIPT}`],
  [ResourceSpanOps.CSS]: [`${FILE_EXTENSION}:css`],
  [ResourceSpanOps.FONT]: [`${FILE_EXTENSION}:[${FONT_FILE_EXTENSIONS.join(',')}]`],
  [ResourceSpanOps.IMAGE]: [
    `${FILE_EXTENSION}:[${IMAGE_FILE_EXTENSIONS.join(',')}]`,
    `${SPAN_OP}:resource.img`,
  ],
};

export const getResourceTypeFilter = (
  selectedSpanOp: string | undefined,
  defaultResourceTypes: string[] | undefined
) => {
  let resourceFilter: string[] = [`${SPAN_OP}:resource.*`];

  if (selectedSpanOp) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    resourceFilter = [SPAN_OP_FILTER[selectedSpanOp].join(' OR ')];
  } else if (defaultResourceTypes) {
    resourceFilter = [
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      defaultResourceTypes.map(type => SPAN_OP_FILTER[type].join(' OR ')).join(' OR '),
    ];
  }
  return ['(', ...resourceFilter, ')'];
};
