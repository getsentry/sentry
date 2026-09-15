import {lazy, useMemo} from 'react';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {
  ResourceLink,
  resourceLinkMarkdown,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';

const LazyGroupList = lazy(async () => {
  const {GroupList} = await import('sentry/components/issues/groupList');
  return {default: GroupList};
});

const BLOCK_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
];

function SingleIssueBlock({id}: {id: string}) {
  const queryParams = useMemo(() => ({query: `issue:${id}`, limit: '1'}), [id]);

  return (
    <LazyLoad
      LazyComponent={LazyGroupList}
      queryParams={queryParams}
      withChart
      withColumns={[]}
      withHeader={false}
      withPagination={false}
      canSelectGroups={false}
      useFilteredStats={false}
      numPlaceholderRows={1}
    />
  );
}

function MultiIssueBlock({ids}: {ids: string[]}) {
  const queryParams = useMemo(
    () => ({
      query: `issue:[${ids.join(',')}]`,
      limit: String(ids.length),
    }),
    [ids]
  );

  return (
    <LazyLoad
      LazyComponent={LazyGroupList}
      queryParams={queryParams}
      withChart
      withColumns={BLOCK_COLUMNS}
      withPagination={false}
      canSelectGroups={false}
      useFilteredStats={false}
      numPlaceholderRows={ids.length}
    />
  );
}

export const Issue = defineSeerEmbed({
  name: 'issue',
  render({id}, level) {
    switch (level) {
      case 'block':
        return <SingleIssueBlock id={id} />;
      case 'markdown':
        return resourceLinkMarkdown(`/issues/${id}/`, id);
      case 'inline':
        return <ResourceLink icon={IconIssues} href={`/issues/${id}/`} title={id} />;
    }
  },
});

export const Issues = defineSeerEmbed({
  name: 'issues',
  render({ids}, level) {
    switch (level) {
      case 'markdown':
        // The table's columns are all live data. What a copy can carry is the
        // set of issues it was listing, one link each.
        return ids
          .flatMap(id => resourceLinkMarkdown(`/issues/${id}/`, id) ?? [])
          .map(link => `- ${link}`)
          .join('\n');
      case 'block':
      case 'inline':
        return <MultiIssueBlock ids={ids} />;
    }
  },
});
