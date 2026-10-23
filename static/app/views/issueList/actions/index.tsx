import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Grid} from '@sentry/scraps/layout';

import {bulkDelete, mergeGroups} from 'sentry/actionCreators/group';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {
  STREAM_GROUP_HEADER_LABELS,
  StreamGroupHeaderCell,
  StreamGroupHeaderRow,
  type StreamGroupColumn,
} from 'sentry/components/stream/groupColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniq} from 'sentry/utils/array/uniq';
import {useApi} from 'sentry/utils/useApi';
import {useIsStuck} from 'sentry/utils/useIsStuck';
import {useOrganization} from 'sentry/utils/useOrganization';
import {BULK_LIMIT, BULK_LIMIT_STR} from 'sentry/views/issueList/actions/constants';
import {
  useIssueSelectionActions,
  useIssueSelectionSummary,
} from 'sentry/views/issueList/issueSelectionContext';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';
import {TOP_BAR_HEIGHT_CSS_VAR} from 'sentry/views/navigation/constants';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

import {ActionSet} from './actionSet';
import {TrendHeader} from './headers';
import {ConfirmAction, invalidateIssueQueries, performBulkUpdate} from './utils';

type IssueListActionsProps = {
  allResultsVisible: boolean;
  columns: StreamGroupColumn[];
  displayReprocessingActions: boolean;
  groupIds: string[];
  onDelete: () => void;
  onSelectStatsPeriod: (period: string) => void;
  query: string;
  queryCount: number;
  selection: PageFilters;
  selectionEnabled: boolean;
  sort: IssueSortOptions;
  statsPeriod: string;
  onActionTaken?: (itemIds: string[], data: IssueUpdateData) => void;
};

const labelAnimationProps: MotionNodeAnimationOptions = {
  initial: {translateY: 8, opacity: 0},
  animate: {translateY: 0, opacity: 1},
  transition: {duration: 0.1},
};

const actionsAnimationProps: MotionNodeAnimationOptions = {
  ...labelAnimationProps,
  exit: {translateY: -8, opacity: 0},
};

function ActionsBarPriority({
  anySelected,
  columns,
  displayReprocessingActions,
  pageSelected,
  queryCount,
  selectedIdsSet,
  multiSelected,
  allInQuerySelected,
  query,
  handleDelete,
  handleMerge,
  handleUpdate,
  isStuck,
  toggleSelectAllVisible,
  selectedProjectSlug,
  selectionEnabled,
  onSelectStatsPeriod,
  statsPeriod,
  selection,
}: {
  allInQuerySelected: boolean;
  anySelected: boolean;
  columns: StreamGroupColumn[];
  displayReprocessingActions: boolean;
  handleDelete: () => void;
  handleMerge: () => void;
  handleUpdate: (data: IssueUpdateData) => void;
  isStuck: boolean;
  multiSelected: boolean;
  onSelectStatsPeriod: (period: string) => void;
  pageSelected: boolean;
  query: string;
  queryCount: number;
  selectedIdsSet: Set<string>;
  selectedProjectSlug: string | undefined;
  selection: PageFilters;
  selectionEnabled: boolean;
  statsPeriod: string;
  toggleSelectAllVisible: () => void;
}) {
  const shouldDisplayActions = anySelected && selectionEnabled;

  return (
    <StreamGroupHeaderRow square={isStuck}>
      <AnimatePresence initial={false}>
        {columns.map(column => {
          if (column.key === 'select') {
            return (
              <SelectHeaderCell key={column.key}>
                <Flex>
                  <Checkbox
                    onChange={toggleSelectAllVisible}
                    checked={pageSelected || (anySelected ? 'indeterminate' : false)}
                    aria-label={pageSelected ? t('Deselect all') : t('Select all')}
                    disabled={displayReprocessingActions}
                  />
                </Flex>
              </SelectHeaderCell>
            );
          }

          if (column.key === 'issue') {
            return (
              <StreamGroupHeaderCell
                key={column.key}
                column={column}
                variant={shouldDisplayActions ? 'remaining' : undefined}
              >
                <AnimatePresence initial={false} mode="wait">
                  {shouldDisplayActions ? (
                    displayReprocessingActions ? null : (
                      <ActionSetGrid
                        key="actions"
                        width={{zero: 'auto', '4xl': '50%'}}
                        gap="xs"
                        flow="column"
                        justify="start"
                        whiteSpace="nowrap"
                        {...actionsAnimationProps}
                      >
                        <ActionSet
                          queryCount={queryCount}
                          query={query}
                          issues={selectedIdsSet}
                          allInQuerySelected={allInQuerySelected}
                          anySelected={anySelected}
                          multiSelected={multiSelected}
                          selectedProjectSlug={selectedProjectSlug}
                          onShouldConfirm={action =>
                            shouldConfirm(action, {pageSelected, selectedIdsSet})
                          }
                          onDelete={handleDelete}
                          onMerge={handleMerge}
                          onUpdate={handleUpdate}
                        />
                      </ActionSetGrid>
                    )
                  ) : (
                    <motion.div key="label" {...labelAnimationProps}>
                      {STREAM_GROUP_HEADER_LABELS[column.key]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </StreamGroupHeaderCell>
            );
          }

          if (shouldDisplayActions) {
            return null;
          }

          return (
            <StreamGroupHeaderCell key={column.key} column={column}>
              <motion.div {...labelAnimationProps}>
                {column.key === 'graph' ? (
                  <TrendHeader
                    onSelectStatsPeriod={onSelectStatsPeriod}
                    selection={selection}
                    statsPeriod={statsPeriod}
                  />
                ) : (
                  STREAM_GROUP_HEADER_LABELS[column.key]
                )}
              </motion.div>
            </StreamGroupHeaderCell>
          );
        })}
      </AnimatePresence>
    </StreamGroupHeaderRow>
  );
}

export function IssueListActions({
  allResultsVisible,
  columns,
  displayReprocessingActions,
  groupIds,
  onActionTaken,
  onDelete,
  onSelectStatsPeriod,
  queryCount,
  query,
  selection,
  selectionEnabled,
  sort,
  statsPeriod,
}: IssueListActionsProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {setAllInQuerySelected, deselectAll, toggleSelectAllVisible} =
    useIssueSelectionActions();
  const {pageSelected, multiSelected, anySelected, allInQuerySelected, selectedIdsSet} =
    useIssueSelectionSummary();
  const selectedProjectSlug = useMemo(() => {
    const projects = Array.from(selectedIdsSet, id => GroupStore.get(id))
      .filter((group): group is Group => !!group?.project)
      .map(group => group.project.slug);
    const uniqProjects = uniq(projects);
    return uniqProjects.length === 1 ? uniqProjects[0] : undefined;
  }, [selectedIdsSet]);
  const area = useAnalyticsArea();
  const numIssues = selectedIdsSet.size;
  const stickyHeadRef = useRef<HTMLTableSectionElement>(null);
  const {pageContentTop} = useTopOffset();
  const isStuck = useIsStuck(stickyHeadRef, {
    offset: Number.parseInt(pageContentTop, 10) || 0,
  });

  function actionSelectedGroups(callback: (itemIds: string[] | undefined) => void) {
    const selectedIds = allInQuerySelected
      ? undefined // undefined means "all"
      : groupIds.filter(itemId => selectedIdsSet.has(itemId));

    callback(selectedIds);

    deselectAll();
  }

  // TODO: Remove issue.category:error filter when merging/deleting performance issues is supported
  // This silently avoids performance issues for bulk actions
  const queryExcludingPerformanceIssues = `${query ?? ''} issue.category:error`;

  function handleDelete() {
    actionSelectedGroups(async itemIds => {
      try {
        await bulkDelete(api, {
          orgId: organization.slug,
          itemIds,
          query: queryExcludingPerformanceIssues,
          sort,
          project: selection.projects,
          environment: selection.environments,
          ...selection.datetime,
        });
      } catch {
        // GroupStore already shows the error
        // oxlint-disable-next-line react/todo
      } finally {
        if (itemIds?.length !== 0) {
          onDelete();
        }
      }
    });
  }

  function handleMerge() {
    actionSelectedGroups(async itemIds => {
      if (selection.projects[0]) {
        const trackProject = ProjectsStore.getById(`${selection.projects[0]}`);
        trackAnalytics('issues_stream.merged', {
          organization,
          project_id: trackProject?.id,
          platform: trackProject?.platform,
          items_merged: allInQuerySelected ? 'all_in_query' : itemIds?.length,
          area,
        });
      }

      try {
        await mergeGroups(api, {
          orgId: organization.slug,
          itemIds,
          query: queryExcludingPerformanceIssues,
          sort,
          project: selection.projects,
          environment: selection.environments,
          ...selection.datetime,
        });
      } catch {
        // GroupStore already shows the error
      }
    });
  }

  function handleUpdate(data: IssueUpdateData) {
    actionSelectedGroups(itemIds => {
      performBulkUpdate({
        api,
        data,
        itemIds,
        organizationSlug: organization.slug,
        query,
        selection,
        sort,
        onSuccess: updatedItemIds => {
          onActionTaken?.(updatedItemIds ?? [], data);
          invalidateIssueQueries({
            itemIds: updatedItemIds,
            organizationSlug: organization.slug,
            queryClient,
          });
        },
      });
    });
  }

  return (
    <StyledStickyHead ref={stickyHeadRef}>
      <ActionsBarPriority
        isStuck={isStuck}
        query={query}
        queryCount={queryCount}
        selection={selection}
        statsPeriod={statsPeriod}
        allInQuerySelected={allInQuerySelected}
        pageSelected={pageSelected}
        selectedIdsSet={selectedIdsSet}
        displayReprocessingActions={displayReprocessingActions}
        handleDelete={handleDelete}
        handleMerge={handleMerge}
        handleUpdate={handleUpdate}
        toggleSelectAllVisible={toggleSelectAllVisible}
        multiSelected={multiSelected}
        columns={columns}
        selectionEnabled={selectionEnabled}
        selectedProjectSlug={selectedProjectSlug}
        anySelected={anySelected}
        onSelectStatsPeriod={onSelectStatsPeriod}
      />
      {!allResultsVisible && pageSelected && (
        <SimpleTable.FullWidthRow>
          <Alert system variant="info">
            <Flex justify="start" wrap="wrap" gap="md">
              {allInQuerySelected ? (
                queryCount >= BULK_LIMIT ? (
                  tct(
                    'Selected up to the first [count] issues that match this search query.',
                    {
                      count: BULK_LIMIT_STR,
                    }
                  )
                ) : (
                  tct('Selected all [count] issues that match this search query.', {
                    count: queryCount,
                  })
                )
              ) : (
                <Fragment>
                  {tn(
                    '%s issue on this page selected.',
                    '%s issues on this page selected.',
                    numIssues
                  )}

                  <a onClick={() => setAllInQuerySelected(true)}>
                    {queryCount >= BULK_LIMIT
                      ? tct(
                          'Select the first [count] issues that match this search query.',
                          {
                            count: BULK_LIMIT_STR,
                          }
                        )
                      : tct('Select all [count] issues that match this search query.', {
                          count: queryCount,
                        })}
                  </a>
                </Fragment>
              )}
            </Flex>
          </Alert>
        </SimpleTable.FullWidthRow>
      )}
    </StyledStickyHead>
  );
}

function shouldConfirm(
  action: ConfirmAction,
  {pageSelected, selectedIdsSet}: {pageSelected: boolean; selectedIdsSet: Set<string>}
) {
  switch (action) {
    case ConfirmAction.RESOLVE:
    case ConfirmAction.UNRESOLVE:
    case ConfirmAction.ARCHIVE:
    case ConfirmAction.SET_PRIORITY:
    case ConfirmAction.UNBOOKMARK: {
      return pageSelected && selectedIdsSet.size > 1;
    }
    case ConfirmAction.BOOKMARK:
      return selectedIdsSet.size > 1;
    case ConfirmAction.MERGE:
    case ConfirmAction.DELETE:
    default:
      return true; // By default, should confirm ...
  }
}

const ActionSetGrid = styled(motion.create(Grid))`
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;

const SelectHeaderCell = styled(SimpleTable.HeaderCell)`
  padding: 0 0 0 ${p => p.theme.space.xl};
`;

const StyledStickyHead = styled(SimpleTable.Head)`
  position: sticky;
  top: var(${TOP_BAR_HEIGHT_CSS_VAR}, 0px);
  z-index: ${p => p.theme.zIndex.header};
`;
