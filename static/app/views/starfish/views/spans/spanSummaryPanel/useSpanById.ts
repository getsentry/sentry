import {useQuery} from 'sentry/utils/queryClient';
import {HOST} from 'sentry/views/starfish/utils/constants';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';

export const useSpanById = (groupId: string, referrer: string) => {
  const query = `
  SELECT
    group_id,
    action,
    description,
    span_operation,
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    LIMIT 1
  `;

  const result = useQuery<Span[]>({
    queryKey: ['span-by-id', groupId],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}&format=sql`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
    enabled: Boolean(groupId),
  });

  return {...result, data: result.data[0]};
};
