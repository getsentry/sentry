import {useTheme} from '@emotion/react';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {LoadingError} from 'sentry/components/loadingError';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {LoadingStreamGroup, StreamGroup} from 'sentry/components/stream/group';
import {SupergroupRow} from 'sentry/components/stream/supergroupRow';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import {aggregateSupergroupStats} from 'sentry/utils/supergroup/aggregateSupergroupStats';
import type {SupergroupLookup} from 'sentry/utils/supergroup/useSuperGroups';
import {useApi} from 'sentry/utils/useApi';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

import {NoGroupsHandler} from './noGroupsHandler';
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
  supergroupLookup?: SupergroupLookup;
};

type GroupListProps = {
  displayReprocessingLayout: boolean;
  groupIds: string[];
  groupStatsPeriod: string;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
  supergroupLookup?: SupergroupLookup;
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

type RenderItem =
  | {id: string; type: 'issue'}
  | {matchingIds: string[]; supergroup: SupergroupDetail; type: 'supergroup'};

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
  supergroupLookup,
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
      supergroupLookup={supergroupLookup}
    />
  );
}

/**
 * Build a render plan that groups issues by supergroup.
 * Issues sharing a supergroup are collected into a single entry
 * positioned where the first member appears.
 */
function buildRenderItems(
  groupIds: string[],
  getSuperGroupForIssue: (id: string) => SupergroupDetail | null | undefined,
  enabled: boolean
): RenderItem[] {
  if (!enabled) {
    return groupIds.map(id => ({type: 'issue' as const, id}));
  }

  const sgForId = new Map<string, SupergroupDetail | null>();
  const sgMembers = new Map<number, string[]>();

  for (const id of groupIds) {
    const sg = getSuperGroupForIssue(id);
    if (sg && sg.group_ids.length > 1) {
      sgForId.set(id, sg);
      if (!sgMembers.has(sg.id)) {
        sgMembers.set(sg.id, []);
      }
      sgMembers.get(sg.id)!.push(id);
    } else {
      sgForId.set(id, null);
    }
  }

  const seen = new Set<number>();
  const items: RenderItem[] = [];

  for (const id of groupIds) {
    const sg = sgForId.get(id);
    if (sg) {
      if (!seen.has(sg.id)) {
        seen.add(sg.id);
        items.push({
          type: 'supergroup',
          supergroup: sg,
          matchingIds: sgMembers.get(sg.id)!,
        });
      }
    } else {
      items.push({type: 'issue', id});
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
  supergroupLookup,
}: GroupListProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const [isSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );
  const topIssue = groupIds[0];
  const selectDisabled = useMedia(
    `(width < ${isSavedSearchesOpen ? theme.breakpoints.xl : theme.breakpoints.md})`
  );

  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  const getSuperGroupForIssue = (id: string) => supergroupLookup?.[id] ?? null;
  const renderItems = buildRenderItems(groupIds, getSuperGroupForIssue, hasTopIssuesUI);

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
        memberList={group.project ? memberList[group.project.slug] : undefined}
        displayReprocessingLayout={displayReprocessingLayout}
        useFilteredStats
        canSelect={!selectDisabled}
        onPriorityChange={priority => onActionTaken([id], {priority})}
        withColumns={columns}
      />
    );
  };

  return (
    <PanelBody>
      {renderItems.map(item => {
        if (item.type === 'issue') {
          return renderStreamGroup(item.id, COLUMNS);
        }

        const {supergroup, matchingIds} = item;
        const memberGroups = matchingIds
          .map(id => GroupStore.get(id) as Group | undefined)
          .filter((g): g is Group => g !== undefined);
        const stats = aggregateSupergroupStats(memberGroups, groupStatsPeriod);

        return (
          <SupergroupRow
            key={`sg-${supergroup.id}`}
            supergroup={supergroup}
            matchedCount={matchingIds.length}
            aggregatedStats={stats}
          />
        );
      })}
    </PanelBody>
  );
}
