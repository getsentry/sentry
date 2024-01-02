import {IndexedMembersByProject} from 'sentry/actionCreators/members';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelBody from 'sentry/components/panels/panelBody';
import StreamGroup from 'sentry/components/stream/group';
import GroupStore from 'sentry/stores/groupStore';
import {Group} from 'sentry/types';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

import NoGroupsHandler from './noGroupsHandler';
import {IssueSortOptions, SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY} from './utils';

type GroupListBodyProps = {
  displayReprocessingLayout: boolean;
  error: string | null;
  groupIds: string[];
  groupStatsPeriod: string;
  loading: boolean;
  memberList: IndexedMembersByProject;
  query: string;
  refetchGroups: () => void;
  selectedProjectIds: number[];
  sort: string;
};

type GroupListProps = {
  displayReprocessingLayout: boolean;
  groupIds: string[];
  groupStatsPeriod: string;
  memberList: IndexedMembersByProject;
  query: string;
  sort: string;
};

function GroupListBody({
  groupIds,
  memberList,
  query,
  sort,
  displayReprocessingLayout,
  groupStatsPeriod,
  loading,
  error,
  refetchGroups,
  selectedProjectIds,
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
      sort={sort}
      displayReprocessingLayout={displayReprocessingLayout}
      groupStatsPeriod={groupStatsPeriod}
    />
  );
}

function GroupList({
  groupIds,
  memberList,
  query,
  sort,
  displayReprocessingLayout,
  groupStatsPeriod,
}: GroupListProps) {
  const [isSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );
  const topIssue = groupIds[0];
  const showInboxTime = sort === IssueSortOptions.INBOX;
  const canSelect = !useMedia(
    `(max-width: ${
      isSavedSearchesOpen ? theme.breakpoints.large : theme.breakpoints.small
    })`
  );

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
            showInboxTime={showInboxTime}
            canSelect={canSelect}
            narrowGroups={isSavedSearchesOpen}
          />
        );
      })}
    </PanelBody>
  );
}

export default GroupListBody;
