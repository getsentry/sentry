import {useTheme} from '@emotion/react';

import {toast} from '@sentry/scraps/toast';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LoadingError} from 'sentry/components/loadingError';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {LoadingStreamGroup, StreamGroup} from 'sentry/components/stream/group';
import {t} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import type {IndexedMembersByProject} from 'sentry/utils/members/shared';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

import {NoGroupsHandler} from './noGroupsHandler';

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
};

type GroupListProps = {
  displayReprocessingLayout: boolean;
  groupIds: string[];
  groupStatsPeriod: string;
  memberList: IndexedMembersByProject | undefined;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
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
}: {
  displayReprocessingLayout: boolean;
  pageSize: number;
}) {
  return (
    <PanelBody>
      {Array.from({length: pageSize}).map((_, index) => (
        <LoadingStreamGroup
          key={`loading-group-${index}`}
          displayReprocessingLayout={displayReprocessingLayout}
          withColumns={DEFAULT_COLUMNS}
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
}: GroupListBodyProps) {
  const organization = useOrganization();

  if (loading) {
    return (
      <LoadingSkeleton
        displayReprocessingLayout={displayReprocessingLayout}
        pageSize={pageSize}
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
}: GroupListProps) {
  const theme = useTheme();
  const topIssue = groupIds[0];
  const selectDisabled = useMedia(`(width < ${theme.breakpoints.sm})`);

  return (
    <PanelBody>
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
            canSelect={!selectDisabled}
            onPriorityChange={priority => {
              toast.success(t('Reprioritized %s', group.shortId));
              onActionTaken([id], {priority});
            }}
            withColumns={DEFAULT_COLUMNS}
          />
        );
      })}
    </PanelBody>
  );
}
