import {useMemo} from 'react';

import {GroupList} from 'sentry/components/issues/groupList';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';

const BLOCK_COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'priority',
  'assignee',
];

function IssueBlock({groupId}: {groupId: string}) {
  const queryParams = useMemo(
    () => ({query: `issue.id:${groupId}`, limit: '1'}),
    [groupId]
  );

  return (
    <GroupList
      queryParams={queryParams}
      withChart
      withColumns={BLOCK_COLUMNS}
      withPagination={false}
      canSelectGroups={false}
      useFilteredStats={false}
      numPlaceholderRows={1}
    />
  );
}

export const Issue = defineSeerEmbed({
  name: 'issue',
  render({groupId, shortId}, level) {
    if (level === 'block') {
      return <IssueBlock groupId={groupId} />;
    }
    return (
      <ResourceLink icon={IconIssues} href={`/issues/${groupId}/`} title={shortId} />
    );
  },
});
