import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import {
  FONT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
} from 'sentry/views/insights/browser/resources/constants';
import {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import type {ModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import type {ValidSort} from 'sentry/views/insights/browser/resources/utils/useResourceSort';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {
  SPAN_DOMAIN,
  SPAN_GROUP,
  SPAN_OP,
  SPAN_SELF_TIME,
  RESOURCE_RENDER_BLOCKING_STATUS,
  HTTP_RESPONSE_CONTENT_LENGTH,
  FILE_EXTENSION,
  USER_GEO_SUBREGION,
  NORMALIZED_DESCRIPTION,
} = SpanMetricsField;

type Props = {
  referrer: string;
  sort: ValidSort;
  cursor?: string;
  defaultResourceTypes?: string[];
  limit?: number;
  query?: string;
};

export const DEFAULT_RESOURCE_FILTERS = [
  '!sentry.normalized_description:"browser-extension://*"',
];

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
  const resourceFilters = useResourceModuleFilters();

  const queryConditions = [
    ...(query ? [] : getResourcesEventViewQuery(resourceFilters, defaultResourceTypes)),
    query,
  ];

  return useSpanMetrics(
    {
      sorts: [sort],
      search: queryConditions.join(' '),
      cursor,
      limit: limit || 100,
      fields: [
        NORMALIZED_DESCRIPTION,
        SPAN_OP,
        'count()',
        `avg(${SPAN_SELF_TIME})`,
        'epm()',
        SPAN_GROUP,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        'project.id',
        `sum(${SPAN_SELF_TIME})`,
      ],
    },
    referrer
  );
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
