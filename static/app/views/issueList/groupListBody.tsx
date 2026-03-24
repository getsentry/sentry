import {useTheme} from '@emotion/react';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LoadingError} from 'sentry/components/loadingError';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {LoadingStreamGroup, StreamGroup} from 'sentry/components/stream/group';
import {StackedGroup} from 'sentry/components/stream/stackedGroup';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import {useSuperGroupForIssues} from 'sentry/utils/supergroup/useSuperGroupForIssues';
import {useApi} from 'sentry/utils/useApi';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';
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
  pageSize: number;
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

const COLUMNS: GroupListColumn[] = [
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
          withColumns={COLUMNS}
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
  const api = useApi();
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

type RenderItem =
  | {type: 'single'; id: string}
  | {type: 'stack'; supergroup: SupergroupDetail; ids: string[]};

/**
 * Groups issue IDs by their supergroup membership.
 * Issues sharing a supergroup are collected into a single stack entry,
 * positioned where the first member appears in the list.
 */
function buildRenderItems(
  groupIds: string[],
  getSuperGroupForIssue: (id: string) => SupergroupDetail | null | undefined,
  enabled: boolean
): RenderItem[] {
  if (!enabled) {
    return groupIds.map(id => ({type: 'single' as const, id}));
  }

  // First pass: resolve supergroup for each ID and collect groups
  const sgForId = new Map<string, SupergroupDetail | null>();
  const sgMembers = new Map<number, string[]>();

  for (const id of groupIds) {
    const sg = getSuperGroupForIssue(id);
    if (sg === undefined || sg === null) {
      sgForId.set(id, null);
    } else {
      sgForId.set(id, sg);
      if (!sgMembers.has(sg.id)) {
        sgMembers.set(sg.id, []);
      }
      sgMembers.get(sg.id)!.push(id);
    }
  }

  // Second pass: build ordered render items, collapsing supergroup members
  const seen = new Set<number>();
  const items: RenderItem[] = [];

  for (const id of groupIds) {
    const sg = sgForId.get(id);
    if (sg) {
      if (!seen.has(sg.id)) {
        seen.add(sg.id);
        items.push({type: 'stack', supergroup: sg, ids: sgMembers.get(sg.id)!});
      }
    } else {
      items.push({type: 'single', id});
    }
  }

  return items;
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
  const organization = useOrganization();
  const {getSuperGroupForIssue} = useSuperGroupForIssues();
  const [isSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );
  const topIssue = groupIds[0];
  const selectDisabled = useMedia(
    `(width < ${isSavedSearchesOpen ? theme.breakpoints.xl : theme.breakpoints.md})`
  );

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  const renderItems = buildRenderItems(groupIds, getSuperGroupForIssue, hasTopIssuesUI);

  const renderStreamGroup = (group: Group) => (
    <StreamGroup
      key={group.id}
      group={group}
      statsPeriod={groupStatsPeriod}
      query={query}
      hasGuideAnchor={group.id === topIssue}
      memberList={group.project ? memberList[group.project.slug] : undefined}
      displayReprocessingLayout={displayReprocessingLayout}
      useFilteredStats
      canSelect={!selectDisabled}
      onPriorityChange={priority => onActionTaken([group.id], {priority})}
      withColumns={COLUMNS}
    />
  );

  return (
    <PanelBody>
      {renderItems.map(item => {
        if (item.type === 'single') {
          const group = GroupStore.get(item.id) as Group | undefined;
          if (!group) {
            return null;
          }
          return renderStreamGroup(group);
        }

        // Stack: collect resolved Group objects
        const groups = item.ids
          .map(id => GroupStore.get(id) as Group | undefined)
          .filter((g): g is Group => g !== undefined);

        if (groups.length === 0) {
          return null;
        }

        // Single-issue supergroups don't need the stack treatment
        if (item.supergroup.group_ids.length <= 1) {
          return renderStreamGroup(groups[0]!);
        }

        return (
          <StackedGroup
            key={`stack-${item.supergroup.id}`}
            supergroup={item.supergroup}
            groups={groups}
            renderGroup={renderStreamGroup}
          />
        );
      })}
    </PanelBody>
  );
}
