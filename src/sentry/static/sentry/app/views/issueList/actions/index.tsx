import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Checkbox from 'app/components/checkbox';
import QueryCount from 'app/components/queryCount';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t, tct, tn} from 'app/locale';
import GroupStore from 'app/stores/groupStore';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import space from 'app/styles/space';
import {GlobalSelection, Group} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import ActionSet from './actionSet';
import {BULK_LIMIT, BULK_LIMIT_STR, ConfirmAction} from './utils';

type Props = {
  api: Client;
  allResultsVisible: boolean;
  orgId: string;
  selection: GlobalSelection;
  groupIds: string[];
  onRealtimeChange: (realtime: boolean) => void;
  onSelectStatsPeriod: (period: string) => void;
  realtimeActive: boolean;
  statsPeriod: string;
  query: string;
  queryCount: number;
  queryMaxCount: number;
  pageCount: number;
  hasInbox?: boolean;
};

type State = {
  datePickerActive: boolean;
  anySelected: boolean;
  multiSelected: boolean;
  pageSelected: boolean;
  allInQuerySelected: boolean;
  selectedIds: Set<string>;
  selectedProjectSlug?: string;
};

class IssueListActions extends React.Component<Props, State> {
  state: State = {
    datePickerActive: false,
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

  handleSelectStatsPeriod(period: string) {
    return this.props.onSelectStatsPeriod(period);
  }

  handleApplyToAll = () => {
    this.setState({
      allInQuerySelected: true,
    });
  };

  handleUpdate = (data?: any) => {
    const {selection} = this.props;
    this.actionSelectedGroups(itemIds => {
      addLoadingMessage(t('Saving changes\u2026'));

      // If `itemIds` is undefined then it means we expect to bulk update all items
      // that match the query.
      //
      // We need to always respect the projects selected in the global selection header:
      // * users with no global views requires a project to be specified
      // * users with global views need to be explicit about what projects the query will run against
      const projectConstraints = {project: selection.projects};

      this.props.api.bulkUpdate(
        {
          orgId: this.props.orgId,
          itemIds,
          data,
          query: this.props.query,
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
    const {selection} = this.props;

    addLoadingMessage(t('Removing events\u2026'));

    this.actionSelectedGroups(itemIds => {
      this.props.api.bulkDelete(
        {
          orgId: this.props.orgId,
          itemIds,
          query: this.props.query,
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

  handleMerge = () => {
    const {selection} = this.props;

    addLoadingMessage(t('Merging events\u2026'));

    this.actionSelectedGroups(itemIds => {
      this.props.api.merge(
        {
          orgId: this.props.orgId,
          itemIds,
          query: this.props.query,
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
      case ConfirmAction.UNBOOKMARK:
        return this.state.pageSelected && selectedItems.size > 1;
      case ConfirmAction.ACKNOWLEDGE:
      case ConfirmAction.BOOKMARK:
        return selectedItems.size > 1;
      case ConfirmAction.MERGE:
      case ConfirmAction.DELETE:
      default:
        return true; // By default, should confirm ...
    }
  };

  renderHeaders() {
    const {
      selection,
      statsPeriod,
      pageCount,
      queryCount,
      queryMaxCount,
      hasInbox,
    } = this.props;

    return (
      <React.Fragment>
        {hasInbox && (
          <React.Fragment>
            <ActionSetPlaceholder>
              {/* total includes its own space */}
              {tct('Select [count] of [total]', {
                count: <React.Fragment>{pageCount}</React.Fragment>,
                total: (
                  <QueryCount
                    hideParens
                    hideIfEmpty={false}
                    count={queryCount || 0}
                    max={queryMaxCount || 1}
                  />
                ),
              })}
            </ActionSetPlaceholder>
          </React.Fragment>
        )}
        <GraphHeaderWrapper className="hidden-xs hidden-sm">
          <GraphHeader>
            <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
            <GraphToggle
              active={statsPeriod === '24h'}
              onClick={this.handleSelectStatsPeriod.bind(this, '24h')}
            >
              {t('24h')}
            </GraphToggle>
            <GraphToggle
              active={statsPeriod === 'auto'}
              onClick={this.handleSelectStatsPeriod.bind(this, 'auto')}
            >
              {selection.datetime.period || t('Custom')}
            </GraphToggle>
          </GraphHeader>
        </GraphHeaderWrapper>
        <React.Fragment>
          <EventsOrUsersLabel>{t('Events')}</EventsOrUsersLabel>
          <EventsOrUsersLabel>{t('Users')}</EventsOrUsersLabel>
        </React.Fragment>
        <AssigneesLabel className="hidden-xs hidden-sm">
          <IssueToolbarHeader>{t('Assignee')}</IssueToolbarHeader>
        </AssigneesLabel>
        {hasInbox && (
          <ActionsLabel>
            <IssueToolbarHeader>{t('Actions')}</IssueToolbarHeader>
          </ActionsLabel>
        )}
      </React.Fragment>
    );
  }

  render() {
    const {
      allResultsVisible,
      queryCount,
      hasInbox,
      orgId,
      query,
      realtimeActive,
    } = this.props;
    const {
      allInQuerySelected,
      anySelected,
      pageSelected,

      multiSelected,
      selectedProjectSlug,
    } = this.state;
    const issues = this.state.selectedIds;
    const numIssues = issues.size;

    return (
      <Sticky>
        <StyledFlex>
          <ActionsCheckbox>
            <Checkbox onChange={this.handleSelectAll} checked={pageSelected} />
          </ActionsCheckbox>
          {(anySelected || !hasInbox) && (
            <ActionSet
              orgSlug={orgId}
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
            />
          )}
          {(!anySelected || !hasInbox) && this.renderHeaders()}
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

const IssueToolbarHeader = styled(ToolbarHeader)`
  animation: 0.3s FadeIn linear forwards;

  @keyframes FadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

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

const ActionSetPlaceholder = styled(IssueToolbarHeader)`
  @media (min-width: 800px) {
    width: 66.66666666666666%;
  }
  @media (min-width: 992px) {
    width: 50%;
  }

  flex: 1;
  margin-left: ${space(1)};
  margin-right: ${space(1)};
  overflow: hidden;
  min-width: 0;
  white-space: nowrap;
`;

const GraphHeaderWrapper = styled('div')`
  width: 160px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};
  animation: 0.25s FadeIn linear forwards;

  @keyframes FadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

const GraphHeader = styled('div')`
  display: flex;
`;

const StyledToolbarHeader = styled(IssueToolbarHeader)`
  flex: 1;
`;

const GraphToggle = styled('a')<{active: boolean}>`
  font-size: 13px;
  padding-left: 8px;

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.textColor : p.theme.disabled)};
  }
`;

const EventsOrUsersLabel = styled(IssueToolbarHeader)`
  display: inline-grid;
  align-items: center;
  justify-content: flex-end;
  text-align: right;
  width: 60px;
  margin: 0 ${space(2)};

  @media (min-width: ${theme.breakpoints[3]}) {
    width: 80px;
  }
`;

const AssigneesLabel = styled('div')`
  justify-content: flex-end;
  text-align: right;
  width: 80px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};
`;

const ActionsLabel = styled('div')`
  justify-content: flex-end;
  text-align: right;
  width: 80px;
  margin: 0 ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    display: none;
  }
`;

const SelectAllNotice = styled('div')`
  background-color: ${p => p.theme.yellow100};
  border-top: 1px solid ${p => p.theme.yellow300};
  border-bottom: 1px solid ${p => p.theme.yellow300};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: center;
  padding: ${space(0.5)} ${space(1.5)};
`;

const SelectAllLink = styled('a')`
  margin-left: ${space(1)};
`;

export {IssueListActions};

export default withApi(IssueListActions);
