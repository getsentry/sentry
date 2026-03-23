import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';

export function EAPSpansQueryBuilder({
  projects,
  initialQuery,
  onSearch,
  searchSource,
}: {
  initialQuery: string;
  onSearch: (query: string) => void;
  projects: number[];
  searchSource: string;
}) {
  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects,
    initialQuery,
    onSearch,
    searchSource,
  });

  return (
    <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} disallowFreeText />
  );
}
