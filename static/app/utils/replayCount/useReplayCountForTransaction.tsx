import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useReplayExists} from 'sentry/utils/replayCount/useReplayExists';
import {useReplays} from 'sentry/utils/replays/hooks/useReplays';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';

interface Props {
  limit: number;
  transaction: string;
  statsPeriod?: string;
}

export function useReplayCountForTransaction({
  limit,
  transaction,
  statsPeriod = '14d',
}: Props): number | undefined {
  const {selection} = usePageFilters();
  const {replaysExist} = useReplayExists();

  // 1. Segment names approach — query replays directly
  const replaysQuery = useMemo(() => {
    const s = new MutableSearch('');
    s.addFilterValue('segment_names', transaction);
    return s;
  }, [transaction]);

  const {data: replaysData, isPending: isReplaysPending} = useReplays({
    fields: ['id'],
    limit: limit + 1,
    projects: selection.projects,
    query: replaysQuery,
    queryReferrer: 'useReplayCountForTransaction',
    sort: '-started_at',
    statsPeriod,
  });

  const replayIdsFromReplaysSearch = useMemo(() => {
    const rows = (replaysData?.data ?? []) as Array<{id: string}>;
    const ids = rows.map(r => String(r.id)).filter(Boolean);
    return new Set(ids);
  }, [replaysData]);

  const segmentNamesSufficient =
    !isReplaysPending && replayIdsFromReplaysSearch.size > limit;

  // 2. Spans-based fallback. Only fires once segment_names has resolved and
  // came up short, so a fully-covered transaction never issues this query.
  const spansSearch = new MutableSearch('!replayId:"" is_transaction:true');
  spansSearch.addFilterValue('transaction', transaction);
  if (replayIdsFromReplaysSearch.size > 0) {
    spansSearch.addFilterValue(
      '!replayId',
      `[${[...replayIdsFromReplaysSearch].join(',')}]`,
      false
    );
  }

  const {data: spansData, isPending: isSpansPending} = useSpans(
    {
      search: spansSearch,
      fields: ['replayId', 'timestamp'],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      limit: limit * 2,
      enabled: !isReplaysPending && !segmentNamesSufficient,
      pageFilters: {
        ...selection,
        datetime: {
          period: statsPeriod,
          start: null,
          end: null,
          utc: selection.datetime.utc,
        },
      },
    },
    'api.performance.transaction-summary.replay-count'
  );

  if (isReplaysPending) {
    return undefined;
  }

  if (segmentNamesSufficient) {
    return replayIdsFromReplaysSearch.size;
  }

  // Fallback is enabled but hasn't resolved yet.
  if (isSpansPending) {
    return undefined;
  }

  const newCandidateIds = [
    ...new Set(spansData.map(row => String(row.replayId)).filter(Boolean)),
  ];
  if (newCandidateIds.length === 0) {
    return replayIdsFromReplaysSearch.size;
  }

  const existence = replaysExist(newCandidateIds);
  if (Object.keys(existence).length !== newCandidateIds.length) {
    return replayIdsFromReplaysSearch.size;
  }
  const additionalCount = Object.values(existence).filter(Boolean).length;
  return replayIdsFromReplaysSearch.size + additionalCount;
}
