import React from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import {bulkDelete, bulkUpdate, mergeGroups} from 'app/actionCreators/group';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Checkbox from 'app/components/checkbox';
import {t, tct, tn} from 'app/locale';
import GroupStore from 'app/stores/groupStore';
import GuideStore, {GuideStoreState} from 'app/stores/guideStore';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import space from 'app/styles/space';
import {GlobalSelection, Group, Organization} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';
import withApi from 'app/utils/withApi';

import ActionSet from './actionSet';
import Headers from './headers';
import {BULK_LIMIT, BULK_LIMIT_STR, ConfirmAction} from './utils';

type Props = {
  api: Client;
  allResultsVisible: boolean;
  organization: Organization;
  selection: GlobalSelection;
  groupIds: string[];
  onDelete: () => void;
  onRealtimeChange: (realtime: boolean) => void;
  onSelectStatsPeriod: (period: string) => void;
  realtimeActive: boolean;
  statsPeriod: string;
  query: string;
  queryCount: number;
  displayCount: React.ReactElement;
  displayReprocessingActions: boolean;
  hasInbox?: boolean;
  onMarkReviewed?: (itemIds: string[]) => void;
};

type State = {
  datePickerActive: boolean;
  anySelected: boolean;
  multiSelected: boolean;
  pageSelected: boolean;
  allInQuerySelected: boolean;
  selectedIds: Set<string>;
  selectedProjectSlug?: string;
  inboxGuideActive: boolean;
  inboxGuideActiveReview: boolean;
  inboxGuideActiveIgnore: boolean;
};

class IssueListActions extends React.Component<Props, State> {
  state: State = {
    datePickerActive: false,
    anySelected: false,
    multiSelected: false, // more than one selected
    pageSelected: false, // all on current page selected (e.g. 25)
    allInQuerySelected: false, // all in current search query selected (e.g. 1000+)
    selectedIds: new Set(),
    inboxGuideActive: false,
    inboxGuideActiveReview: false,
    inboxGuideActiveIgnore: false,
  };

  componentDidMount() {
    this.handleSelectedGroupChange();
  }

  componentWillUnmount() {
    callIfFunction(this.listener);
    callIfFunction(this.guideListener);
  }

  listener = SelectedGroupStore.listen(() => this.handleSelectedGroupChange(), undefined);
  guideListener = GuideStore.listen(data => this.handleGuideStateChange(data), undefined);

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

  handleGuideStateChange(data: GuideStoreState) {
    const {hasInbox} = this.props;
    const inboxGuideActive = !!(
      hasInbox && data.currentGuide?.guide === 'for_review_guide'
    );
    this.setState({
      inboxGuideActive,
      inboxGuideActiveReview: inboxGuideActive && data.currentStep === 2,
      inboxGuideActiveIgnore: inboxGuideActive && data.currentStep === 3,
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

  handleRealtimeChange = () => {
    this.props.onRealtimeChange(!this.props.realtimeActive);
  };

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
      hasInbox,
      query,
      realtimeActive,
      statsPeriod,
      displayCount,
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
      inboxGuideActive,
      inboxGuideActiveReview,
      inboxGuideActiveIgnore,
    } = this.state;

    const numIssues = issues.size;

    return (
      <Sticky>
        <StyledFlex>
          <ActionsCheckbox>
            <Checkbox
              onChange={this.handleSelectAll}
              checked={pageSelected}
              disabled={displayReprocessingActions}
            />
          </ActionsCheckbox>
          {(anySelected || !hasInbox || inboxGuideActive) &&
            !displayReprocessingActions && (
              <ActionSet
                orgSlug={organization.slug}
                queryCount={queryCount}
                query={query}
                realtimeActive={realtimeActive}
                hasInbox={hasInbox}
                issues={issues}
                allInQuerySelected={allInQuerySelected}
                anySelected={anySelected}
                multiSelected={multiSelected}
                selectedProjectSlug={selectedProjectSlug}
                onShouldConfirm={this.shouldConfirm}
                onDelete={this.handleDelete}
                onRealtimeChange={this.handleRealtimeChange}
                onMerge={this.handleMerge}
                onUpdate={this.handleUpdate}
                inboxGuideActiveReview={inboxGuideActiveReview}
                inboxGuideActiveIgnore={inboxGuideActiveIgnore}
              />
            )}
          <Headers
            onSelectStatsPeriod={this.handleSelectStatsPeriod}
            anySelected={anySelected}
            selection={selection}
            statsPeriod={statsPeriod}
            displayCount={displayCount}
            hasInbox={hasInbox}
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
  z-index: ${p => p.theme.zIndex.header};
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
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  margin-bottom: -1px;
`;

const ActionsCheckbox = styled('div')`
  padding-left: ${space(2)};
  margin-bottom: 1px;
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const SelectAllNotice = styled('div')`
  background-color: ${p => p.theme.yellow100};
  border-top: 1px solid ${p => p.theme.yellow300};
  border-bottom: 1px solid ${p => p.theme.yellow300};
  color: ${p => p.theme.black};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: center;
  padding: ${space(0.5)} ${space(1.5)};
`;

const SelectAllLink = styled('a')`
  margin-left: ${space(1)};
`;

export {IssueListActions};

export default withApi(IssueListActions);
