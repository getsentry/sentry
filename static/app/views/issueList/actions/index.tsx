import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import {bulkDelete, bulkUpdate, mergeGroups} from 'sentry/actionCreators/group';
import {Alert} from 'sentry/components/alert';
import Checkbox from 'sentry/components/checkbox';
import {Sticky} from 'sentry/components/sticky';
import {tct, tn} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Group, PageFilters} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY} from 'sentry/views/issueList/utils';

import ActionSet from './actionSet';
import Headers from './headers';
import IssueListSortOptions from './sortOptions';
import {BULK_LIMIT, BULK_LIMIT_STR, ConfirmAction} from './utils';

type IssueListActionsProps = {
  allResultsVisible: boolean;
  displayReprocessingActions: boolean;
  groupIds: string[];
  onDelete: () => void;
  onSelectStatsPeriod: (period: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  queryCount: number;
  selection: PageFilters;
  sort: string;
  statsPeriod: string;
  onActionTaken?: (itemIds: string[]) => void;
  onMarkReviewed?: (itemIds: string[]) => void;
};

function IssueListActions({
  allResultsVisible,
  displayReprocessingActions,
  groupIds,
  onActionTaken,
  onDelete,
  onMarkReviewed,
  onSelectStatsPeriod,
  onSortChange,
  queryCount,
  query,
  selection,
  sort,
  statsPeriod,
}: IssueListActionsProps) {
  const api = useApi();
  const organization = useOrganization();
  const {
    pageSelected,
    multiSelected,
    anySelected,
    allInQuerySelected,
    selectedIdsSet,
    selectedProjectSlug,
    setAllInQuerySelected,
  } = useSelectedGroupsState();
  const [isSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );

  const disableActions = useMedia(
    `(max-width: ${
      isSavedSearchesOpen ? theme.breakpoints.large : theme.breakpoints.small
    })`
  );

  const numIssues = selectedIdsSet.size;

  function actionSelectedGroups(callback: (itemIds: string[] | undefined) => void) {
    const selectedIds = allInQuerySelected
      ? undefined // undefined means "all"
      : groupIds.filter(itemId => selectedIdsSet.has(itemId));

    callback(selectedIds);

    SelectedGroupStore.deselectAll();
  }

  // TODO: Remove issue.category:error filter when merging/deleting performance issues is supported
  // This silently avoids performance issues for bulk actions
  const queryExcludingPerformanceIssues = `${query ?? ''} issue.category:error`;

  function handleDelete() {
    actionSelectedGroups(itemIds => {
      bulkDelete(
        api,
        {
          orgId: organization.slug,
          itemIds,
          query: queryExcludingPerformanceIssues,
          project: selection.projects,
          environment: selection.environments,
          ...selection.datetime,
        },
        {
          complete: () => {
            onDelete();
          },
        }
      );
    });
  }

  function handleMerge() {
    actionSelectedGroups(itemIds => {
      mergeGroups(
        api,
        {
          orgId: organization.slug,
          itemIds,
          query: queryExcludingPerformanceIssues,
          project: selection.projects,
          environment: selection.environments,
          ...selection.datetime,
        },
        {}
      );
    });
  }

  function handleUpdate(data?: any) {
    if (data.status === 'ignored') {
      const statusDetails = data.statusDetails.ignoreCount
        ? 'ignoreCount'
        : data.statusDetails.ignoreDuration
        ? 'ignoreDuration'
        : data.statusDetails.ignoreUserCount
        ? 'ignoreUserCount'
        : undefined;
      trackAnalytics('issues_stream.archived', {
        action_status_details: statusDetails,
        action_substatus: data.substatus,
        organization,
      });
    }

    actionSelectedGroups(itemIds => {
      if (data?.inbox === false) {
        onMarkReviewed?.(itemIds ?? []);
      }

      onActionTaken?.(itemIds ?? []);

      // If `itemIds` is undefined then it means we expect to bulk update all items
      // that match the query.
      //
      // We need to always respect the projects selected in the global selection header:
      // * users with no global views requires a project to be specified
      // * users with global views need to be explicit about what projects the query will run against
      const projectConstraints = {project: selection.projects};

      bulkUpdate(
        api,
        {
          orgId: organization.slug,
          itemIds,
          data,
          query,
          environment: selection.environments,
          ...projectConstraints,
          ...selection.datetime,
        },
        {}
      );
    });
  }

  return (
    <StickyActions>
      <ActionsBar>
        {!disableActions && (
          <ActionsCheckbox isReprocessingQuery={displayReprocessingActions}>
            <Checkbox
              onChange={() => SelectedGroupStore.toggleSelectAll()}
              checked={pageSelected || (anySelected ? 'indeterminate' : false)}
              disabled={displayReprocessingActions}
            />
          </ActionsCheckbox>
        )}
        {!displayReprocessingActions && (
          <HeaderButtonsWrapper>
            {!disableActions && (
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
            )}
            <IssueListSortOptions sort={sort} query={query} onSelect={onSortChange} />
          </HeaderButtonsWrapper>
        )}
        <Headers
          onSelectStatsPeriod={onSelectStatsPeriod}
          selection={selection}
          statsPeriod={statsPeriod}
          isReprocessingQuery={displayReprocessingActions}
          isSavedSearchesOpen={isSavedSearchesOpen}
        />
      </ActionsBar>
      {!allResultsVisible && pageSelected && (
        <Alert type="warning" system>
          <SelectAllNotice data-test-id="issue-list-select-all-notice">
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
                <SelectAllLink
                  onClick={() => setAllInQuerySelected(true)}
                  data-test-id="issue-list-select-all-notice-link"
                >
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
                </SelectAllLink>
              </Fragment>
            )}
          </SelectAllNotice>
        </Alert>
      )}
    </StickyActions>
  );
}

function useSelectedGroupsState() {
  const [allInQuerySelected, setAllInQuerySelected] = useState(false);
  const selectedIds = useLegacyStore(SelectedGroupStore);

  const selected = SelectedGroupStore.getSelectedIds();
  const projects = [...selected]
    .map(id => GroupStore.get(id))
    .filter((group): group is Group => !!(group && group.project))
    .map(group => group.project.slug);

  const uniqProjects = uniq(projects);
  // we only want selectedProjectSlug set if there is 1 project
  // more or fewer should result in a null so that the action toolbar
  // can behave correctly.
  const selectedProjectSlug = uniqProjects.length === 1 ? uniqProjects[0] : undefined;

  const pageSelected = SelectedGroupStore.allSelected();
  const multiSelected = SelectedGroupStore.multiSelected();
  const anySelected = SelectedGroupStore.anySelected();
  const selectedIdsSet = SelectedGroupStore.getSelectedIds();

  useEffect(() => {
    setAllInQuerySelected(false);
  }, [selectedIds]);

  return {
    pageSelected,
    multiSelected,
    anySelected,
    allInQuerySelected,
    selectedIdsSet,
    selectedProjectSlug,
    setAllInQuerySelected,
  };
}

function shouldConfirm(
  action: ConfirmAction,
  {pageSelected, selectedIdsSet}: {pageSelected: boolean; selectedIdsSet: Set<string>}
) {
  switch (action) {
    case ConfirmAction.RESOLVE:
    case ConfirmAction.UNRESOLVE:
    case ConfirmAction.IGNORE:
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

const StickyActions = styled(Sticky)`
  z-index: ${p => p.theme.zIndex.issuesList.stickyHeader};

  /* Remove border radius from the action bar when stuck. Without this there is
   * a small gap where color can peek through. */
  &[data-stuck] > div {
    border-radius: 0;
  }
`;

const ActionsBar = styled('div')`
  display: flex;
  min-height: 45px;
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
  align-items: center;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  border-radius: ${p => p.theme.panelBorderRadius} ${p => p.theme.panelBorderRadius} 0 0;
  margin: 0 -1px -1px;
`;

const ActionsCheckbox = styled('div')<{isReprocessingQuery: boolean}>`
  display: flex;
  align-items: center;
  padding-left: ${space(2)};
  margin-bottom: 1px;
  ${p => p.isReprocessingQuery && 'flex: 1'};
`;

const HeaderButtonsWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 50%;
  }
  flex: 1;
  margin: 0 ${space(1)};
  display: grid;
  gap: ${space(0.5)};
  grid-auto-flow: column;
  justify-content: flex-start;
  white-space: nowrap;
`;

const SelectAllNotice = styled('div')`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;

  a:not([role='button']) {
    color: ${p => p.theme.linkColor};
    border-bottom: none;
  }
`;

const SelectAllLink = styled('a')`
  margin-left: ${space(1)};
`;

export {IssueListActions};

export default IssueListActions;
