import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import type {PageFilters} from 'sentry/types/core';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import IssueListActions from 'sentry/views/issueList/actions';
import GroupListBody from 'sentry/views/issueList/groupListBody';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

interface IssueListBodyProps {
  allResultsVisible: boolean;
  displayReprocessingActions: boolean;
  error: string | null;
  groupIds: string[];
  issuesLoading: boolean;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  onDelete: () => void;
  onSelectStatsPeriod: (period: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  queryCount: number;
  refetchGroups: (fetchAllCounts?: boolean) => void;
  selectedProjectIds: number[];
  selection: PageFilters;
  sort: string;
  statsPeriod: string;
}

function IssueListBody({
  allResultsVisible,
  displayReprocessingActions,
  groupIds,
  onDelete,
  onSelectStatsPeriod,
  onSortChange,
  query,
  queryCount,
  selection,
  sort,
  statsPeriod,
  onActionTaken,
  issuesLoading,
  memberList,
  refetchGroups,
  error,
}: IssueListBodyProps) {
  return (
    <Panel>
      {groupIds.length !== 0 && (
        <IssueListActions
          selection={selection}
          query={query}
          queryCount={queryCount}
          onSelectStatsPeriod={onSelectStatsPeriod}
          onActionTaken={onActionTaken}
          onDelete={onDelete}
          statsPeriod={statsPeriod}
          groupIds={groupIds}
          allResultsVisible={allResultsVisible}
          displayReprocessingActions={displayReprocessingActions}
          sort={sort}
          onSortChange={onSortChange}
        />
      )}
      <PanelBody>
        <VisuallyCompleteWithData
          hasData={groupIds.length > 0}
          id="IssueList-Body"
          isLoading={issuesLoading}
        >
          <GroupListBody
            memberList={memberList}
            groupStatsPeriod={statsPeriod}
            groupIds={groupIds}
            displayReprocessingLayout={displayReprocessingActions}
            query={query}
            selectedProjectIds={selection.projects}
            loading={issuesLoading}
            error={error}
            refetchGroups={refetchGroups}
            onActionTaken={onActionTaken}
          />
        </VisuallyCompleteWithData>
      </PanelBody>
    </Panel>
  );
}

export default IssueListBody;
