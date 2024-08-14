import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanIndexedField} from 'sentry/views/insights/types';

const {SPAN_DESCRIPTION, HTTP_RESPONSE_CONTENT_LENGTH, RAW_DOMAIN} = SpanIndexedField;

type Options = {
  enabled?: boolean;
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
  enabled = true,
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
        RAW_DOMAIN,
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
      enabled,
      refetchOnWindowFocus: false,
    },
  });

  const data =
    result?.data?.data.map(row => ({
      project: row.project as string,
      'transaction.id': row['transaction.id'] as string,
      [SPAN_DESCRIPTION]: row[SPAN_DESCRIPTION]?.toString(),
      [RAW_DOMAIN]: row[RAW_DOMAIN]?.toString(),
      'measurements.http.response_content_length': row[
        `measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`
      ] as number,
    })) ?? [];

  return {...result, data};
};
