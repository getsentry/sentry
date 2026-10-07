import {lazy} from 'react';
import styled from '@emotion/styled';

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
      <FlushIssueList>
        <LazyLoad
          LazyComponent={LazyGroupList}
          canSelectGroups={false}
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
      </FlushIssueList>
    </ErrorBoundary>
  );
}

/**
 * Mirrors `QueryEmbedTable`'s `FlushTable`: the card's border already frames
 * the list, so `GroupList`'s table keeps only its top rule.
 */
const FlushIssueList = styled('div')`
  > div,
  > div > table {
    border-width: 1px 0 0;
    border-radius: 0;
    margin-bottom: 0;
  }

  > div > table > thead > tr {
    border-radius: 0;
  }
`;
