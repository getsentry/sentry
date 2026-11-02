import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingStreamGroup, StreamGroup} from 'sentry/components/stream/group';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import type {IndexedMembersByProject} from 'sentry/utils/members/shared';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

import {NoGroupsHandler} from './noGroupsHandler';

type GroupListBodyProps = {
  canSelect: boolean;
  displayReprocessingLayout: boolean;
  error: string | null;
  groupIds: string[];
  groupStatsPeriod: string;
  loading: boolean;
  memberList: IndexedMembersByProject | undefined;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  pageSize: number;
  query: string;
  refetchGroups: () => void;
  selectedProjectIds: number[];
};

type GroupListProps = {
  canSelect: boolean;
  displayReprocessingLayout: boolean;
  groupIds: string[];
  groupStatsPeriod: string;
  memberList: IndexedMembersByProject | undefined;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
};

export const ISSUE_LIST_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
];

function LoadingSkeleton({
  canSelect,
  pageSize,
  displayReprocessingLayout,
}: {
  canSelect: boolean;
  displayReprocessingLayout: boolean;
  pageSize: number;
}) {
  return (
    <SimpleTable.Body>
      {Array.from({length: pageSize}).map((_, index) => (
        <LoadingStreamGroup
          key={`loading-group-${index}`}
          canSelect={canSelect}
          displayReprocessingLayout={displayReprocessingLayout}
          withColumns={ISSUE_LIST_COLUMNS}
        />
      ))}
    </SimpleTable.Body>
  );
}

export function GroupListBody({
  canSelect,
  groupIds,
  memberList,
  query,
  displayReprocessingLayout,
  groupStatsPeriod,
  loading,
  error,
  refetchGroups,
  selectedProjectIds,
  pageSize,
  onActionTaken,
}: GroupListBodyProps) {
  const organization = useOrganization();

  if (loading) {
    return (
      <LoadingSkeleton
        canSelect={canSelect}
        displayReprocessingLayout={displayReprocessingLayout}
        pageSize={pageSize}
      />
    );
  }

  if (error) {
    return (
      <SimpleTable.Body>
        <SimpleTable.FullWidthRow>
          <LoadingError message={error} onRetry={refetchGroups} />
        </SimpleTable.FullWidthRow>
      </SimpleTable.Body>
    );
  }

  if (!groupIds.length) {
    return (
      <SimpleTable.Body>
        <SimpleTable.FullWidthRow>
          <NoGroupsHandler
            organization={organization}
            query={query}
            selectedProjectIds={selectedProjectIds}
            groupIds={groupIds}
          />
        </SimpleTable.FullWidthRow>
      </SimpleTable.Body>
    );
  }

  return (
    <GroupList
      canSelect={canSelect}
      groupIds={groupIds}
      memberList={memberList}
      query={query}
      displayReprocessingLayout={displayReprocessingLayout}
      groupStatsPeriod={groupStatsPeriod}
      onActionTaken={onActionTaken}
    />
  );
}

function GroupList({
  canSelect,
  groupIds,
  memberList,
  query,
  displayReprocessingLayout,
  groupStatsPeriod,
  onActionTaken,
}: GroupListProps) {
  const topIssue = groupIds[0];

  return (
    <SimpleTable.Body>
      {groupIds.map(id => {
        const group = GroupStore.get(id) as Group | undefined;
        if (!group) {
          return null;
        }
        return (
          <StreamGroup
            key={id}
            group={group}
            statsPeriod={groupStatsPeriod}
            query={query}
            hasGuideAnchor={id === topIssue}
            memberList={group.project ? memberList?.get(group.project.slug) : undefined}
            displayReprocessingLayout={displayReprocessingLayout}
            useFilteredStats
            canSelect={canSelect}
            onPriorityChange={priority => onActionTaken([id], {priority})}
            withColumns={ISSUE_LIST_COLUMNS}
          />
        );
      })}
    </SimpleTable.Body>
  );
}
