import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQueryState} from 'nuqs';

import {useResponsivePropValue} from '@sentry/scraps/layout';
import type {CursorHandler} from '@sentry/scraps/pagination';
import {Pagination} from '@sentry/scraps/pagination';
import {HoverOverlayGroupProvider} from '@sentry/scraps/useHoverOverlay';

import {
  StreamGroupTable,
  useStreamGroupColumns,
} from 'sentry/components/stream/groupColumns';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import type {IndexedMembersByProject} from 'sentry/utils/members/shared';
import {getPaginationProps} from 'sentry/utils/pagination';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';

import {IssueListActions} from './actions';
import {GroupListBody, ISSUE_LIST_COLUMNS} from './groupListBody';
import {IssueListBulkCommandPaletteActions} from './issueListBulkCommandPaletteActions';
import {NewViewEmptyState} from './newViewEmptyState';
import type {IssueUpdateData} from './types';
import type {IssueSortOptions} from './utils';

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
  sort: IssueSortOptions;
  statsLoading: boolean;
  statsPeriod: string;
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
  sort,
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
}: IssueListTableProps) {
  const [newParam] = useQueryState('new');
  const selectDisabled = useResponsivePropValue({zero: true, xl: false});
  const {columns, selectionEnabled} = useStreamGroupColumns({
    canSelect: !selectDisabled,
    displayReprocessingLayout: displayReprocessingActions,
    withChart: true,
    withColumns: ISSUE_LIST_COLUMNS,
  });

  const isNewViewEmptyStateActive =
    newParam === 'true' && !issuesLoading && !error && !issuesSuccessfullyLoaded;

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
            <IssueListBulkCommandPaletteActions
              query={query}
              queryCount={queryCount}
              selection={selection}
              sort={sort}
              groupIds={groupIds}
              onActionTaken={onActionTaken}
            />
            <StreamGroupTable columns={columns} data-test-id="issue-list">
              {(groupIds.length > 0 || issuesLoading) && (
                <HoverOverlayGroupProvider>
                  <IssueListActions
                    columns={columns}
                    selectionEnabled={selectionEnabled}
                    selection={selection}
                    sort={sort}
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
                </HoverOverlayGroupProvider>
              )}
              <HoverOverlayGroupProvider>
                <VisuallyCompleteWithData
                  hasData={groupIds.length > 0}
                  id="IssueList-Body"
                  isLoading={issuesLoading}
                >
                  <GroupListBody
                    canSelect={!selectDisabled}
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
                  />
                </VisuallyCompleteWithData>
              </HoverOverlayGroupProvider>
            </StreamGroupTable>
          </div>
        )}
      </DemoTourElement>
      <StyledPagination
        caption={paginationCaption}
        {...getPaginationProps(pageLinks)}
        onCursor={onCursor}
        onPageChange={(_cursor, delta) =>
          paginationAnalyticsEvent(delta === -1 ? 'Previous' : 'Next')
        }
      />
    </Fragment>
  );
}

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;
