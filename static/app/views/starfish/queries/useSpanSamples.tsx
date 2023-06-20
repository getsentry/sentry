import * as qs from 'query-string';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {SpanIndexedFields, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {getDateConditions} from 'sentry/views/starfish/utils/getDateConditions';

const DEFAULT_LIMIT = 10;
const DEFAULT_ORDER_BY = '-duration';

export function useSpanSamples(
  groupId?: string,
  transaction?: string,
  limit?: number,
  orderBy?: string,
  referrer: string = 'use-span-samples'
) {
  const location = useLocation();
  const organization = useOrganization();

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: 'Span Samples',
      query: `${groupId ? ` group:${groupId}` : ''} ${
        transaction ? ` transaction:${transaction}` : ''
      }`,
      fields: [
        'span_id',
        'group',
        'action',
        'description',
        'domain',
        'module',
        SpanIndexedFields.SPAN_SELF_TIME,
        'op',
        'transaction_id',
        'timestamp',
      ],
      dataset: DiscoverDatasets.SPANS_INDEXED,
      orderby: orderBy ?? DEFAULT_ORDER_BY,
      projects: [1],
      version: 2,
    },
    location
  );

  const response = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
    referrer,
    limit: limit ?? DEFAULT_LIMIT,
  });

  const data = (response.data?.data ?? []) as unknown as IndexedSpan[];
  const pageLinks = response.pageLinks;

  return {...response, data, pageLinks};
}

type Options = {
  groupId?: string;
  transactionName?: string;
};

type SpanSample = Pick<
  SpanIndexedFieldTypes,
  | SpanIndexedFields.SPAN_SELF_TIME
  | SpanIndexedFields.TRANSACTION_ID
  | SpanIndexedFields.PROJECT
  | SpanIndexedFields.TIMESTAMP
>;

export const useSpanSamples2 = (options: Options) => {
  const url = '/api/0/organizations/sentry/spans-samples/';
  const api = useApi();
  const {selection} = usePageFilters();
  const {groupId, transactionName} = options;
  const query = new MutableSearch([`span.group:${groupId}`]);

  return useQuery<SpanSample[]>({
    queryKey: ['span-samples', groupId, transactionName],
    queryFn: async () => {
      const res = await api.requestPromise(
        `${url}?${qs.stringify({
          ...getDateConditions(selection),
          group: groupId,
          query: query.formatString(),
        })}`
      );
      return res?.data;
    },
    enabled: Boolean(groupId && transactionName),
    initialData: [],
  });
};
