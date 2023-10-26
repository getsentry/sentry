import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {SpanIndexedField} from 'sentry/views/starfish/types';

const {
  SPAN_DESCRIPTION,
  SPAN_OP,
  HTTP_RESPONSE_CONTENT_LENGTH,
  SPAN_SELF_TIME,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = SpanIndexedField;

export const useIndexedResourcesQuery = () => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const resourceFilters = useResourceModuleFilters();
  const {slug: orgSlug} = useOrganization();
  const queryConditions = [
    `${SPAN_OP}:resource.img`,
    ...(resourceFilters['resource.render_blocking_status']
      ? [
          `resource.render_blocking_status:${resourceFilters['resource.render_blocking_status']}`,
        ]
      : [`!resource.render_blocking_status:blocking`]),
  ];

  // TODO - we should be using metrics data here
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'id',
        'project',
        'span.group',
        'transaction.id',
        'count_unique(span.description)',
        SPAN_DESCRIPTION,
        SPAN_SELF_TIME,
        HTTP_RESPONSE_CONTENT_LENGTH,
        RESOURCE_RENDER_BLOCKING_STATUS,
      ],
      name: 'Resource module - resource table',
      query: queryConditions.join(' '),
      version: 2,
      orderby: '-count()',
      dataset: DiscoverDatasets.SPANS_INDEXED,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({
    eventView,
    limit: 100,
    location,
    orgSlug,
    referrer: 'api.performance.browswer.resource.image-table',
  });

  const data =
    result?.data?.data.map(row => ({
      id: row.id as string,
      project: row.project as string,
      'transaction.id': row['transaction.id'] as string,
      [SPAN_DESCRIPTION]: row[SPAN_DESCRIPTION].toString(),
      [SPAN_SELF_TIME]: row[SPAN_SELF_TIME] as number,
      [RESOURCE_RENDER_BLOCKING_STATUS]: row[RESOURCE_RENDER_BLOCKING_STATUS] as
        | ''
        | 'non-blocking'
        | 'blocking',
      [HTTP_RESPONSE_CONTENT_LENGTH]: row[HTTP_RESPONSE_CONTENT_LENGTH] as number,
    })) ?? [];

  return {...result, data};
};
