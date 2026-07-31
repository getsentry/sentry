import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {Location} from 'history';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {EventView} from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {REPLAY_LIST_FIELDS} from 'sentry/views/explore/replays/types';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

import type {EventSpanData, ReplayListRecordWithTx} from './types';

const REPLAYS_LIMIT = 50;

interface Options {
  location: Location;
  replayIdsEventView: EventView;
  sort: string;
  transactionName: string;
}

interface Result {
  error: unknown;
  isPending: boolean;
  playlistEventView: EventView;
  replays: ReplayListRecordWithTx[] | undefined;
}

export function useTransactionReplays({
  transactionName,
  sort,
  replayIdsEventView,
  location,
}: Options): Result {
  const api = useApi();
  const org = useOrganization();
  const {selection} = usePageFilters();
  const projects = selection.projects;

  const locationWith90d = useMemo(
    () => ({
      ...location,
      query: {
        ...location.query,
        statsPeriod: '90d',
      },
    }),
    [location]
  );

  const {data, isPending, error} = useQuery({
    queryKey: [
      'transactionReplays',
      transactionName,
      sort,
      org.slug,
      projects,
      replayIdsEventView.getEventsAPIPayload(locationWith90d),
    ],
    queryFn: async ({signal, client, meta}) => {
      const fetchContext = {signal, client, meta};

      // Fetch the transactions first: their replayIds seed the id-based fallback
      // clause of the combined replays query below.
      const transactions = await fetchTransactions(
        api,
        org.slug,
        replayIdsEventView,
        locationWith90d
      );
      const fallbackIds = [
        ...new Set(transactions.map(e => String(e.replayId)).filter(Boolean)),
      ];

      // A single replays query unions the segment-name matches with the
      // span-derived ids, so the server owns sorting, dedupe, and the limit.
      const query = buildReplaysQuery(transactionName, fallbackIds);
      const replays = await fetchReplays(fetchContext, org.slug, projects, query, sort);

      return {
        replays: enrichWithSlowestTransaction(replays, transactions),
        // Surface the exact query so the playlist matches the table contents.
        query,
      };
    },
    staleTime: 0,
  });

  const playlistEventView = useMemo(() => {
    // Reuse the same query the table was built from so the playlist can't drift.
    const query = data?.query ?? buildReplaysQuery(transactionName, []);
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [],
      query,
      orderby: sort,
      range: '90d',
    });
  }, [data?.query, transactionName, sort]);

  return {
    replays: data?.replays,
    isPending,
    error,
    playlistEventView,
  };
}

function buildReplaysQuery(transactionName: string, fallbackIds: string[]): string {
  const segmentClause = new MutableSearch('');
  segmentClause.addFilterValue('segment_names', transactionName);
  const segment = segmentClause.formatString();

  if (fallbackIds.length === 0) {
    return segment;
  }

  return `(${segment}) OR (id:[${fallbackIds.join(',')}])`;
}

async function fetchTransactions(
  api: ReturnType<typeof useApi>,
  orgSlug: string,
  eventView: EventView,
  location: Location
): Promise<EventSpanData[]> {
  const [result] = await doDiscoverQuery<{data: EventSpanData[]}>(
    api,
    `/organizations/${orgSlug}/events/`,
    eventView.getEventsAPIPayload(location)
  );
  return result.data ?? [];
}

type FetchContext = Pick<Parameters<typeof apiFetch>[0], 'client' | 'signal' | 'meta'>;

async function fetchReplays(
  fetchContext: FetchContext,
  orgSlug: string,
  projects: number[],
  query: string,
  sort: string
): Promise<ReplayListRecord[]> {
  const url = getApiUrl('/organizations/$organizationIdOrSlug/replays/', {
    path: {organizationIdOrSlug: orgSlug},
  });
  const response = await apiFetch<{data: unknown[]}>({
    ...fetchContext,
    queryKey: [
      url,
      {
        query: {
          field: REPLAY_LIST_FIELDS,
          per_page: REPLAYS_LIMIT,
          project: projects,
          sort,
          statsPeriod: '90d',
          query,
          queryReferrer: 'useTransactionReplays',
        },
      },
      {infinite: false},
    ],
  });
  return response.json.data.map(mapResponseToReplayRecord);
}

function enrichWithSlowestTransaction(
  replays: ReplayListRecord[],
  transactions: EventSpanData[]
): ReplayListRecordWithTx[] {
  return replays.map(replay => {
    const slowestEvent = transactions.reduce<Record<string, any>>((slowest, event) => {
      if (event.replayId !== replay.id) {
        return slowest;
      }
      if (!slowest['transaction.duration']) {
        return event;
      }
      return event['transaction.duration'] > slowest['transaction.duration']
        ? event
        : slowest;
    }, {});

    return {...replay, txEvent: slowestEvent};
  });
}
