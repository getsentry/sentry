import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useReplayExists} from 'sentry/utils/replayCount/useReplayExists';
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

  const search = new MutableSearch('!replayId:"" is_transaction:true');
  search.addFilterValue('transaction', transaction);

  const {data, isPending} = useSpans(
    {
      search,
      // Note that this has to be `replayId` and not `replay.id` - only
      // `replayId` holds sampled replays, while `replay.id` currently also
      // holds the ID of Replays that were active but not sampled.
      // See REPLAY-893.
      fields: ['replayId', 'timestamp'],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      // Over-fetch so we can still distinguish "limit+" from an exact count
      // when some candidate IDs don't exist in the replays dataset.
      limit: limit * 2,
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

  if (isPending) {
    return undefined;
  }

  const candidateIds = Array.from(
    new Set(data.map(row => String(row.replayId)).filter(Boolean))
  );
  if (candidateIds.length === 0) {
    return 0;
  }

  const existence = replaysExist(candidateIds);
  if (Object.keys(existence).length !== candidateIds.length) {
    return undefined;
  }
  return Object.values(existence).filter(Boolean).length;
}
