import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';

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
        'duration',
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
  const pageLinks = response.data?.pageLinks;

  return {...response, data, pageLinks};
}
