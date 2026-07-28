import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {GroupList} from 'sentry/components/issues/groupList';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const BLOCK_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
];

function SingleIssueBlock({groupId}: {groupId: string}) {
  const queryParams = useMemo(
    () => ({query: `issue.id:${groupId}`, limit: '1'}),
    [groupId]
  );

  return (
    <GroupList
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

function SingleIssueLink({groupId}: {groupId: string}) {
  const organization = useOrganization();
  const {data} = useQuery(
    apiOptions.as<Group>()('/organizations/$organizationIdOrSlug/issues/$issueId/', {
      path: {organizationIdOrSlug: organization.slug, issueId: groupId},
      staleTime: Infinity,
    })
  );
  const shortId = data?.shortId ?? groupId;

  return <ResourceLink icon={IconIssues} href={`/issues/${groupId}/`} title={shortId} />;
}

function MultiIssueBlock({groupIds}: {groupIds: string[]}) {
  const queryParams = useMemo(
    () => ({
      query: `issue.id:[${groupIds.join(',')}]`,
      limit: String(groupIds.length),
    }),
    [groupIds]
  );

  return (
    <GroupList
      queryParams={queryParams}
      withChart
      withColumns={BLOCK_COLUMNS}
      withPagination={false}
      canSelectGroups={false}
      useFilteredStats={false}
      numPlaceholderRows={groupIds.length}
    />
  );
}

export const Issue = defineSeerEmbed({
  name: 'issue',
  render({groupId}, level) {
    if (level === 'block') {
      return <SingleIssueBlock groupId={groupId} />;
    }
    return <SingleIssueLink groupId={groupId} />;
  },
});

export const Issues = defineSeerEmbed({
  name: 'issues',
  render({groupIds}) {
    return <MultiIssueBlock groupIds={groupIds} />;
  },
});
