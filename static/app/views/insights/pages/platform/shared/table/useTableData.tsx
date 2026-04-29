import type {Sort} from 'sentry/utils/discover/fields';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import type {SpanProperty} from 'sentry/views/insights/types';

const PER_PAGE = 10;

export function useSpanTableData<Fields extends SpanProperty>({
  fields,
  referrer,
  query,
  sort,
}: {
  fields: Fields[];
  query: string | MutableSearch;
  referrer: string;
  sort: Sort;
}) {
  const {cursor} = useTableCursor();

  const isValidSortKey = fields.includes(sort.field as Fields);

  return useSpans(
    {
      search: query,
      sorts: isValidSortKey ? [sort] : undefined,
      fields,
      limit: PER_PAGE,
      keepPreviousData: true,
      cursor,
    },
    referrer
  );
}
