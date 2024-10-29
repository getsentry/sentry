import {Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import type {PageFilters} from 'sentry/types/core';
import type {SavedSearch} from 'sentry/types/group';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import IssueListActions from 'sentry/views/issueList/actions';
import AddViewPage from 'sentry/views/issueList/addViewPage';
import GroupListBody from 'sentry/views/issueList/groupListBody';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';

interface IssueListTableProps {
  allResultsVisible: boolean;
  displayReprocessingActions: boolean;
  error: string | null;
  groupIds: string[];
  issuesLoading: boolean;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  onCursor: CursorHandler;
  onDelete: () => void;
  onSelectStatsPeriod: (period: string) => void;
  onSortChange: (sort: string) => void;
  organizationSavedSearches: SavedSearch[];
  pageLinks: string;
  paginationAnalyticsEvent: (direction: string) => void;
  paginationCaption: React.ReactNode;
  personalSavedSearches: SavedSearch[];
  query: string;
  queryCount: number;
  refetchGroups: (fetchAllCounts?: boolean) => void;
  selectedProjectIds: number[];
  selection: PageFilters;
  sort: string;
  statsPeriod: string;
}

function IssueListTable({
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
  paginationCaption,
  pageLinks,
  onCursor,
  paginationAnalyticsEvent,
  personalSavedSearches,
  organizationSavedSearches,
}: IssueListTableProps) {
  const {newViewActive} = useContext(NewTabContext);

  return newViewActive ? (
    <AddViewPage
      personalSavedSearches={personalSavedSearches}
      organizationSavedSearches={organizationSavedSearches}
    />
  ) : (
    <Fragment>
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
      <StyledPagination
        caption={paginationCaption}
        pageLinks={pageLinks}
        onCursor={onCursor}
        paginationAnalyticsEvent={paginationAnalyticsEvent}
      />
    </Fragment>
  );
}

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

export default IssueListTable;
