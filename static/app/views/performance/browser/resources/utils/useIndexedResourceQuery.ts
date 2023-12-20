import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanIndexedField} from 'sentry/views/starfish/types';

const {SPAN_DESCRIPTION, HTTP_RESPONSE_CONTENT_LENGTH} = SpanIndexedField;

type Options = {
  limit?: number;
  queryConditions?: string[];
  referrer?: string;
  sorts?: Sort[];
};

export const useIndexedResourcesQuery = ({
  queryConditions = [],
  limit = 50,
  sorts,
  referrer,
}: Options) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const {slug: orgSlug} = useOrganization();

  // TODO - we should be using metrics data here
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        `any(id)`,
        'project',
        'span.group',
        SPAN_DESCRIPTION,
        `measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`,
      ],
      name: 'Indexed Resource Query',
      query: queryConditions.join(' '),
      version: 2,
      dataset: DiscoverDatasets.SPANS_INDEXED,
    },
    pageFilters.selection
  );

  if (sorts) {
    eventView.sorts = sorts;
  }

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
      project: row.project as string,
      'transaction.id': row['transaction.id'] as string,
      [SPAN_DESCRIPTION]: row[SPAN_DESCRIPTION]?.toString(),
      'measurements.http.response_content_length': row[
        `measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`
      ] as number,
    })) ?? [];

  return {...result, data};
};
