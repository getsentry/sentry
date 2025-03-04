import {useTheme} from '@emotion/react';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelBody from 'sentry/components/panels/panelBody';
import StreamGroup from 'sentry/components/stream/group';
import GroupStore from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

import NoGroupsHandler from './noGroupsHandler';
import {SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY} from './utils';

type GroupListBodyProps = {
  displayReprocessingLayout: boolean;
  error: string | null;
  groupIds: string[];
  groupStatsPeriod: string;
  loading: boolean;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
  refetchGroups: () => void;
  selectedProjectIds: number[];
};

type GroupListProps = {
  displayReprocessingLayout: boolean;
  groupIds: string[];
  groupStatsPeriod: string;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
};

function GroupListBody({
  groupIds,
  memberList,
  query,
  displayReprocessingLayout,
  groupStatsPeriod,
  loading,
  error,
  refetchGroups,
  selectedProjectIds,
  onActionTaken,
}: GroupListBodyProps) {
  const api = useApi();
  const organization = useOrganization();

  if (loading) {
    return <LoadingIndicator hideMessage />;
  }

  if (error) {
    return <LoadingError message={error} onRetry={refetchGroups} />;
  }

  if (!groupIds.length) {
    return (
      <NoGroupsHandler
        api={api}
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
  const organization = useOrganization();
  const theme = useTheme();
  const [isSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );
  const topIssue = groupIds[0];
  const canSelect = !useMedia(
    `(max-width: ${
      isSavedSearchesOpen ? theme.breakpoints.xlarge : theme.breakpoints.medium
    })`
  );

  const columns: GroupListColumn[] = [
    'graph',
    ...(organization.features.includes('issue-stream-table-layout')
      ? ['lifespan' as const]
      : []),
    'event',
    'users',
    'priority',
    'assignee',
    'lastTriggered',
  ];

  return (
    <PanelBody>
      {groupIds.map((id, index) => {
        const hasGuideAnchor = id === topIssue;
        const group = GroupStore.get(id) as Group | undefined;

        return (
          <StreamGroup
            index={index}
            key={id}
            id={id}
            statsPeriod={groupStatsPeriod}
            query={query}
            hasGuideAnchor={hasGuideAnchor}
            memberList={group?.project ? memberList[group.project.slug] : undefined}
            displayReprocessingLayout={displayReprocessingLayout}
            useFilteredStats
            canSelect={canSelect}
            narrowGroups={isSavedSearchesOpen}
            onPriorityChange={priority => onActionTaken([id], {priority})}
            withColumns={columns}
          />
        );
      })}
    </PanelBody>
  );
}

export default GroupListBody;
