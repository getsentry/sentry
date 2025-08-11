import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import IssueListActions from 'sentry/views/issueList/actions';
import GroupListBody from 'sentry/views/issueList/groupListBody';
import {NewViewEmptyState} from 'sentry/views/issueList/newViewEmptyState';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

interface IssueListTableProps {
  allResultsVisible: boolean;
  displayReprocessingActions: boolean;
  error: string | null;
  groupIds: string[];
  issuesLoading: boolean;
  issuesSuccessfullyLoaded: boolean;
  memberList: IndexedMembersByProject;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  onCursor: CursorHandler;
  onDelete: () => void;
  onSelectStatsPeriod: (period: string) => void;
  pageLinks: string;
  paginationAnalyticsEvent: (direction: string) => void;
  paginationCaption: React.ReactNode;
  query: string;
  queryCount: number;
  refetchGroups: (fetchAllCounts?: boolean) => void;
  selectedProjectIds: number[];
  selection: PageFilters;
  statsPeriod: string;
}

function IssueListTable({
  allResultsVisible,
  displayReprocessingActions,
  groupIds,
  onDelete,
  onSelectStatsPeriod,
  query,
  queryCount,
  selection,
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
  issuesSuccessfullyLoaded,
}: IssueListTableProps) {
  const location = useLocation();

  const isNewViewEmptyStateActive =
    location.query.new === 'true' &&
    !issuesLoading &&
    !error &&
    !issuesSuccessfullyLoaded;

  if (isNewViewEmptyStateActive) {
    return <NewViewEmptyState />;
  }

  return (
    <Fragment>
      <DemoTourElement
        id={DemoTourStep.ISSUES_STREAM}
        title={t('Issues')}
        description={t(
          'Sentry automatically groups similar events together into an issue. Similarity is determined by stack trace and other factors. Click on an issue to learn more.'
        )}
        disabled={issuesLoading}
      >
        <ContainerPanel>
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
        </ContainerPanel>
      </DemoTourElement>
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

const ContainerPanel = styled(Panel)`
  container-type: inline-size;
`;

export default IssueListTable;
