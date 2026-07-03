import {useTheme} from '@emotion/react';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LoadingError} from 'sentry/components/loadingError';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {LoadingStreamGroup, StreamGroup} from 'sentry/components/stream/group';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import type {IndexedMembersByProject} from 'sentry/utils/members/shared';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import {useIssueProgress} from 'sentry/views/issueList/useIssueProgress';

import {NoGroupsHandler} from './noGroupsHandler';
import {SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY} from './utils';

type GroupListBodyProps = {
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
  onGroupClick?: (group: Group) => void;
  withColumns?: GroupListColumn[];
};

type GroupListProps = {
  displayReprocessingLayout: boolean;
  groupIds: string[];
  groupStatsPeriod: string;
  memberList: IndexedMembersByProject | undefined;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
  onGroupClick?: (group: Group) => void;
  withColumns?: GroupListColumn[];
};

const DEFAULT_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
  'lastTriggered',
];

function LoadingSkeleton({
  pageSize,
  displayReprocessingLayout,
  columns,
}: {
  columns: GroupListColumn[];
  displayReprocessingLayout: boolean;
  pageSize: number;
}) {
  return (
    <PanelBody>
      {Array.from({length: pageSize}).map((_, index) => (
        <LoadingStreamGroup
          key={`loading-group-${index}`}
          displayReprocessingLayout={displayReprocessingLayout}
          withColumns={columns}
        />
      ))}
    </PanelBody>
  );
}

export function GroupListBody({
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
  onGroupClick,
  withColumns,
}: GroupListBodyProps) {
  const organization = useOrganization();
  const columns = withColumns ?? DEFAULT_COLUMNS;

  if (loading) {
    return (
      <LoadingSkeleton
        displayReprocessingLayout={displayReprocessingLayout}
        pageSize={pageSize}
        columns={columns}
      />
    );
  }

  if (error) {
    return <LoadingError message={error} onRetry={refetchGroups} />;
  }

  if (!groupIds.length) {
    return (
      <NoGroupsHandler
        organization={organization}
        query={query}
        selectedProjectIds={selectedProjectIds}
        groupIds={groupIds}
      />
    );
  }

  return (
    <GroupList
      groupIds={groupIds}
      memberList={memberList}
      query={query}
      displayReprocessingLayout={displayReprocessingLayout}
      groupStatsPeriod={groupStatsPeriod}
      onActionTaken={onActionTaken}
      onGroupClick={onGroupClick}
      withColumns={columns}
    />
  );
}

function GroupList({
  groupIds,
  memberList,
  query,
  displayReprocessingLayout,
  groupStatsPeriod,
  onActionTaken,
  onGroupClick,
  withColumns = DEFAULT_COLUMNS,
}: GroupListProps) {
  const theme = useTheme();
  const [isSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );
  const topIssue = groupIds[0];
  const selectDisabled = useMedia(
    `(width < ${isSavedSearchesOpen ? theme.breakpoints.xl : theme.breakpoints.md})`
  );

  const showProgress = withColumns.includes('progress');
  const {data: progressData} = useIssueProgress(showProgress ? groupIds : []);

  const renderStreamGroup = (id: string, columns: GroupListColumn[]) => {
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
        canSelect={!selectDisabled}
        onPriorityChange={priority => onActionTaken([id], {priority})}
        onGroupClick={onGroupClick}
        withColumns={columns}
        progressState={
          showProgress ? (progressData?.results[id]?.progress ?? null) : undefined
        }
      />
    );
  };

  return <PanelBody>{groupIds.map(id => renderStreamGroup(id, withColumns))}</PanelBody>;
}
