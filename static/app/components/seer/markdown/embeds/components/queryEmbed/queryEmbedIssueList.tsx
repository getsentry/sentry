import {lazy} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {GroupListColumn, GroupListProps} from 'sentry/components/issues/groupList';
import {LazyLoad} from 'sentry/components/lazyLoad';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

const PREVIEW_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'priority',
  'assigneeAvatar',
];

interface QueryEmbedIssueListProps {
  queryParams: GroupListProps['queryParams'];
  /** Analytics source recorded on each issue row's link. */
  source: string;
  query?: string;
}

/**
 * An issue stream preview for `QueryEmbedCard`'s `table` slot. Issues keep
 * `GroupList`'s rows, since those carry the graph, priority, and assignee a
 * plain table can't, but the list is restyled to sit in the card the same way
 * a `QueryEmbedTable` does.
 */
export function QueryEmbedIssueList({
  query,
  queryParams,
  source,
}: QueryEmbedIssueListProps) {
  return (
    <ErrorBoundary mini>
      <LazyLoad
        LazyComponent={LazyGroupList}
        canSelectGroups={false}
        border="top"
        numPlaceholderRows={3}
        query={query}
        queryParams={queryParams}
        source={source}
        staleTime={30_000}
        useFilteredStats
        withChart
        withColumns={PREVIEW_COLUMNS}
        withPagination={false}
      />
    </ErrorBoundary>
  );
}
