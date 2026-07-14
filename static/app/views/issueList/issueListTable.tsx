import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {CursorHandler} from '@sentry/scraps/pagination';
import {Pagination} from '@sentry/scraps/pagination';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import type {IndexedMembersByProject} from 'sentry/utils/members/shared';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {HoverOverlayGroupProvider} from 'sentry/utils/useHoverOverlay';
import {useLocation} from 'sentry/utils/useLocation';
import {IssueListActions} from 'sentry/views/issueList/actions';
import {GroupListBody} from 'sentry/views/issueList/groupListBody';
import {IssueListBulkCommandPaletteActions} from 'sentry/views/issueList/issueListBulkCommandPaletteActions';
import {NewViewEmptyState} from 'sentry/views/issueList/newViewEmptyState';
import type {SupergroupLookup} from 'sentry/views/issueList/supergroups/useSuperGroups';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

interface IssueListTableProps {
  allResultsVisible: boolean;
  displayReprocessingActions: boolean;
  error: string | null;
  groupIds: string[];
  issuesLoading: boolean;
  issuesSuccessfullyLoaded: boolean;
  memberList: IndexedMembersByProject | undefined;
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  onCursor: CursorHandler;
  onDelete: () => void;
  onSelectStatsPeriod: (period: string) => void;
  pageLinks: string;
  pageSize: number;
  paginationAnalyticsEvent: (direction: string) => void;
  paginationCaption: React.ReactNode;
  query: string;
  queryCount: number;
  refetchGroups: (fetchAllCounts?: boolean) => void;
  selection: PageFilters;
  statsLoading: boolean;
  statsPeriod: string;
  onGroupClick?: (group: Group) => void;
  supergroupLookup?: SupergroupLookup;
  withColumns?: GroupListColumn[];
}

export function IssueListTable({
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
  statsLoading,
  memberList,
  refetchGroups,
  error,
  paginationCaption,
  pageLinks,
  onCursor,
  paginationAnalyticsEvent,
  issuesSuccessfullyLoaded,
  pageSize,
  onGroupClick,
  supergroupLookup,
  withColumns,
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
        {tourProps => (
          <div {...tourProps}>
            <ContainerPanel data-test-id="issue-list">
              <IssueListBulkCommandPaletteActions
                query={query}
                queryCount={queryCount}
                selection={selection}
                groupIds={groupIds}
                onActionTaken={onActionTaken}
              />
              {(groupIds.length > 0 || issuesLoading) && (
                <HoverOverlayGroupProvider>
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
                    withColumns={withColumns}
                  />
                </HoverOverlayGroupProvider>
              )}
              <HoverOverlayGroupProvider>
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
                      // we need the stats loading and group id check because group ids do not update immediately
                      loading={issuesLoading || (statsLoading && !groupIds.length)}
                      error={error}
                      pageSize={pageSize}
                      refetchGroups={refetchGroups}
                      onActionTaken={onActionTaken}
                      onGroupClick={onGroupClick}
                      supergroupLookup={supergroupLookup}
                      withColumns={withColumns}
                    />
                  </VisuallyCompleteWithData>
                </PanelBody>
              </HoverOverlayGroupProvider>
            </ContainerPanel>
          </div>
        )}
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
