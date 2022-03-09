import * as React from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import {bulkDelete, bulkUpdate, mergeGroups} from 'sentry/actionCreators/group';
import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {alertStyles} from 'sentry/components/alert';
import Checkbox from 'sentry/components/checkbox';
import {t, tct, tn} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import space from 'sentry/styles/space';
import {Group, Organization, PageFilters} from 'sentry/types';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import withApi from 'sentry/utils/withApi';

import ActionSet from './actionSet';
import Headers from './headers';
import {BULK_LIMIT, BULK_LIMIT_STR, ConfirmAction} from './utils';

type Props = {
  allResultsVisible: boolean;
  api: Client;
  displayCount: React.ReactNode;
  displayReprocessingActions: boolean;
  groupIds: string[];
  onDelete: () => void;
  onSelectStatsPeriod: (period: string) => void;
  organization: Organization;
  query: string;
  queryCount: number;
  selection: PageFilters;
  statsPeriod: string;
  onMarkReviewed?: (itemIds: string[]) => void;
};

type State = {
  allInQuerySelected: boolean;
  anySelected: boolean;
  multiSelected: boolean;
  pageSelected: boolean;
  selectedIds: Set<string>;
  selectedProjectSlug?: string;
};

class IssueListActions extends React.Component<Props, State> {
  state: State = {
    anySelected: false,
    multiSelected: false, // more than one selected
    pageSelected: false, // all on current page selected (e.g. 25)
    allInQuerySelected: false, // all in current search query selected (e.g. 1000+)
    selectedIds: new Set(),
  };

  componentDidMount() {
    this.handleSelectedGroupChange();
  }

  componentWillUnmount() {
    callIfFunction(this.listener);
  }

  listener = SelectedGroupStore.listen(() => this.handleSelectedGroupChange(), undefined);

  actionSelectedGroups(callback: (itemIds: string[] | undefined) => void) {
    let selectedIds: string[] | undefined;

    if (this.state.allInQuerySelected) {
      selectedIds = undefined; // undefined means "all"
    } else {
      const itemIdSet = SelectedGroupStore.getSelectedIds();
      selectedIds = this.props.groupIds.filter(itemId => itemIdSet.has(itemId));
    }

    callback(selectedIds);

    this.deselectAll();
  }

  deselectAll() {
    SelectedGroupStore.deselectAll();
    this.setState({allInQuerySelected: false});
  }

  // Handler for when `SelectedGroupStore` changes
  handleSelectedGroupChange() {
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

    this.setState({
      pageSelected: SelectedGroupStore.allSelected(),
      multiSelected: SelectedGroupStore.multiSelected(),
      anySelected: SelectedGroupStore.anySelected(),
      allInQuerySelected: false, // any change resets
      selectedIds: SelectedGroupStore.getSelectedIds(),
      selectedProjectSlug,
    });
  }

  handleSelectStatsPeriod = (period: string) => {
    return this.props.onSelectStatsPeriod(period);
  };

  handleApplyToAll = () => {
    this.setState({allInQuerySelected: true});
  };

  handleUpdate = (data?: any) => {
    const {selection, api, organization, query, onMarkReviewed} = this.props;
    const orgId = organization.slug;

    this.actionSelectedGroups(itemIds => {
      addLoadingMessage(t('Saving changes\u2026'));

      if (data?.inbox === false) {
        onMarkReviewed?.(itemIds ?? []);
      }

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
          orgId,
          itemIds,
          data,
          query,
          environment: selection.environments,
          ...projectConstraints,
          ...selection.datetime,
        },
        {
          complete: () => {
            clearIndicators();
          },
        }
      );
    });
  };

  handleDelete = () => {
    const {selection, api, organization, query, onDelete} = this.props;
    const orgId = organization.slug;

    addLoadingMessage(t('Removing events\u2026'));

    this.actionSelectedGroups(itemIds => {
      bulkDelete(
        api,
        {
          orgId,
          itemIds,
          query,
          project: selection.projects,
          environment: selection.environments,
          ...selection.datetime,
        },
        {
          complete: () => {
            clearIndicators();
            onDelete();
          },
        }
      );
    });
  };

  handleMerge = () => {
    const {selection, api, organization, query} = this.props;
    const orgId = organization.slug;

    addLoadingMessage(t('Merging events\u2026'));

    this.actionSelectedGroups(itemIds => {
      mergeGroups(
        api,
        {
          orgId,
          itemIds,
          query,
          project: selection.projects,
          environment: selection.environments,
          ...selection.datetime,
        },
        {
          complete: () => {
            clearIndicators();
          },
        }
      );
    });
  };

  handleSelectAll() {
    SelectedGroupStore.toggleSelectAll();
  }

  shouldConfirm = (action: ConfirmAction) => {
    const selectedItems = SelectedGroupStore.getSelectedIds();

    switch (action) {
      case ConfirmAction.RESOLVE:
      case ConfirmAction.UNRESOLVE:
      case ConfirmAction.IGNORE:
      case ConfirmAction.UNBOOKMARK: {
        const {pageSelected} = this.state;
        return pageSelected && selectedItems.size > 1;
      }
      case ConfirmAction.BOOKMARK:
        return selectedItems.size > 1;
      case ConfirmAction.MERGE:
      case ConfirmAction.DELETE:
      default:
        return true; // By default, should confirm ...
    }
  };
  render() {
    const {
      allResultsVisible,
      queryCount,
      query,
      statsPeriod,
      selection,
      organization,
      displayReprocessingActions,
    } = this.props;

    const {
      allInQuerySelected,
      anySelected,
      pageSelected,
      selectedIds: issues,
      multiSelected,
      selectedProjectSlug,
    } = this.state;

    const numIssues = issues.size;

    return (
      <Sticky>
        <StyledFlex>
          <ActionsCheckbox isReprocessingQuery={displayReprocessingActions}>
            <Checkbox
              onChange={this.handleSelectAll}
              checked={pageSelected}
              disabled={displayReprocessingActions}
            />
          </ActionsCheckbox>
          {!displayReprocessingActions && (
            <ActionSet
              orgSlug={organization.slug}
              queryCount={queryCount}
              query={query}
              issues={issues}
              allInQuerySelected={allInQuerySelected}
              anySelected={anySelected}
              multiSelected={multiSelected}
              selectedProjectSlug={selectedProjectSlug}
              onShouldConfirm={this.shouldConfirm}
              onDelete={this.handleDelete}
              onMerge={this.handleMerge}
              onUpdate={this.handleUpdate}
            />
          )}
          <Headers
            onSelectStatsPeriod={this.handleSelectStatsPeriod}
            anySelected={anySelected}
            selection={selection}
            statsPeriod={statsPeriod}
            isReprocessingQuery={displayReprocessingActions}
          />
        </StyledFlex>
        {!allResultsVisible && pageSelected && (
          <SelectAllNotice>
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
              <React.Fragment>
                {tn(
                  '%s issue on this page selected.',
                  '%s issues on this page selected.',
                  numIssues
                )}
                <SelectAllLink onClick={this.handleApplyToAll}>
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
              </React.Fragment>
            )}
          </SelectAllNotice>
        )}
      </Sticky>
    );
  }
}

const Sticky = styled('div')`
  position: sticky;
  z-index: ${p => p.theme.zIndex.issuesList.stickyHeader};
  top: -1px;
`;

const StyledFlex = styled('div')`
  display: flex;
  box-sizing: border-box;
  min-height: 45px;
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
  align-items: center;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  margin: 0 -1px -1px;
`;

const ActionsCheckbox = styled('div')<{isReprocessingQuery: boolean}>`
  padding-left: ${space(2)};
  margin-bottom: 1px;
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
  ${p => p.isReprocessingQuery && 'flex: 1'};
`;

const SelectAllNotice = styled('div')`
  ${p => alertStyles({theme: p.theme, type: 'warning', system: true, opaque: true})}
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  padding: ${space(0.5)} ${space(1.5)};
  border-top-width: 1px;

  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};

  a:not([role='button']) {
    color: ${p => p.theme.linkColor};
    border-bottom: none;
  }
`;

const SelectAllLink = styled('a')`
  margin-left: ${space(1)};
`;

export {IssueListActions};

export default withApi(IssueListActions);
