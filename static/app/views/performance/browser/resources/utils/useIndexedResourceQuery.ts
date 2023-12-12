import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanIndexedField} from 'sentry/views/starfish/types';

const {
  SPAN_DESCRIPTION,
  HTTP_RESPONSE_CONTENT_LENGTH,
  SPAN_SELF_TIME,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = SpanIndexedField;

type Options = {
  limit?: number;
  queryConditions?: string[];
  referrer?: string;
};

export const useIndexedResourcesQuery = ({
  queryConditions = [],
  limit = 50,
  referrer,
}: Options) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const {slug: orgSlug} = useOrganization();

  // TODO - we should be using metrics data here
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'id',
        'project',
        'span.group',
        'transaction.id',
        SPAN_DESCRIPTION,
        SPAN_SELF_TIME,
        HTTP_RESPONSE_CONTENT_LENGTH,
        RESOURCE_RENDER_BLOCKING_STATUS,
      ],
      name: 'Indexed Resource Query',
      query: queryConditions.join(' '),
      version: 2,
      orderby: '-count()',
      dataset: DiscoverDatasets.SPANS_INDEXED,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({
    eventView,
    limit,
    location,
    orgSlug,
    referrer,
    options: {
      refetchOnWindowFocus: false,
    },
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
      // TODO - parseFloat here is temporary, we should be parsing from the backend
      [HTTP_RESPONSE_CONTENT_LENGTH]: parseFloat(
        (row[HTTP_RESPONSE_CONTENT_LENGTH] as string) || '0'
      ),
    })) ?? [];

  return {...result, data};
};
