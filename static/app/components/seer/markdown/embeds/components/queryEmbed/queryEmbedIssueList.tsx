import {lazy} from 'react';
import styled from '@emotion/styled';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {GroupListColumn, GroupListProps} from 'sentry/components/issues/groupList';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {PanelHeader} from 'sentry/components/panels/panelHeader';

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
 * the list, so `GroupList`'s panel keeps only its top rule. A direct-child
 * selector rather than `${Panel}`, because `GroupList` renders a
 * `styled(Panel)` whose class no longer carries `Panel`'s own selector target.
 *
 * The header takes `SimpleTable`'s header treatment. `PanelHeader` otherwise
 * sets its labels in small primary text through a selector that outranks the
 * secondary color `IssueStreamHeaderLabel` asks for, so they read darker than
 * the table headers in every other query embed.
 */
const FlushIssueList = styled('div')`
  > div {
    border-width: 1px 0 0;
    border-radius: 0;
    margin-bottom: 0;
  }

  ${PanelHeader} {
    min-height: 40px;
    padding-top: 0;
    padding-bottom: 0;
    border-radius: 0;
  }

  && ${PanelHeader} > * {
    font-size: ${p => p.theme.font.size.md};
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
