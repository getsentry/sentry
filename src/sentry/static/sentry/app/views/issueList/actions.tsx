import capitalize from 'lodash/capitalize';
import uniq from 'lodash/uniq';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {t, tct, tn} from 'app/locale';
import {IconEllipsis, IconPause, IconPlay} from 'app/icons';
import {Client} from 'app/api';
import {
  GlobalSelection,
  Group,
  Organization,
  Project,
  UpdateResolutionStatus,
} from 'app/types';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import ActionLink from 'app/components/actions/actionLink';
import Checkbox from 'app/components/checkbox';
import DropdownLink from 'app/components/dropdownLink';
import ExternalLink from 'app/components/links/externalLink';
import GroupStore from 'app/stores/groupStore';
import IgnoreActions from 'app/components/actions/ignore';
import MenuItem from 'app/components/menuItem';
import Projects from 'app/utils/projects';
import ResolveActions from 'app/components/actions/resolve';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import SentryTypes from 'app/sentryTypes';
import ToolbarHeader from 'app/components/toolbarHeader';
import Tooltip from 'app/components/tooltip';
import withApi from 'app/utils/withApi';
import QuestionTooltip from 'app/components/questionTooltip';

const BULK_LIMIT = 1000;
const BULK_LIMIT_STR = BULK_LIMIT.toLocaleString();

const getBulkConfirmMessage = (action: string, queryCount: number) => {
  if (queryCount > BULK_LIMIT) {
    return tct(
      'Are you sure you want to [action] the first [bulkNumber] issues that match the search?',
      {
        action,
        bulkNumber: BULK_LIMIT_STR,
      }
    );
  }

  return tct(
    'Are you sure you want to [action] all [bulkNumber] issues that match the search?',
    {
      action,
      bulkNumber: queryCount,
    }
  );
};

const getConfirm = (
  numIssues: number,
  allInQuerySelected: boolean,
  query: string,
  queryCount: number
) =>
  function (action, canBeUndone, append = '') {
    const question = allInQuerySelected
      ? getBulkConfirmMessage(`${action}${append}`, queryCount)
      : tn(
          `Are you sure you want to ${action} this %s issue${append}?`,
          `Are you sure you want to ${action} these %s issues${append}?`,
          numIssues
        );

    const message =
      action === 'delete'
        ? tct(
            'Bulk deletion is only recommended for junk data. To clear your stream, consider resolving or ignoring. [link:When should I delete events?]',
            {
              link: (
                <ExternalLink href="https://help.sentry.io/hc/en-us/articles/360003443113-When-should-I-delete-events" />
              ),
            }
          )
        : t('This action cannot be undone.');

    return (
      <div>
        <p style={{marginBottom: '20px'}}>
          <strong>{question}</strong>
        </p>
        <ExtraDescription
          all={allInQuerySelected}
          query={query}
          queryCount={queryCount}
        />
        {!canBeUndone && <p>{message}</p>}
      </div>
    );
  };

const getLabel = (numIssues: number, allInQuerySelected: boolean) =>
  function (action, append = '') {
    const capitalized = capitalize(action);
    const text = allInQuerySelected
      ? t(`Bulk ${action} issues`)
      : tn(
          `${capitalized} %s selected issue`,
          `${capitalized} %s selected issues`,
          numIssues
        );

    return text + append;
  };

type ExtraDescriptionProps = {
  all: boolean;
  query: string;
  queryCount: number;
};

const ExtraDescription = ({all, query, queryCount}: ExtraDescriptionProps) => {
  if (!all) {
    return null;
  }

  if (query) {
    return (
      <div>
        <p>{t('This will apply to the current search query') + ':'}</p>
        <pre>{query}</pre>
      </div>
    );
  }
  return (
    <p className="error">
      <strong>
        {queryCount > BULK_LIMIT
          ? tct(
              'This will apply to the first [bulkNumber] issues matched in this project!',
              {
                bulkNumber: BULK_LIMIT_STR,
              }
            )
          : tct('This will apply to all [bulkNumber] issues matched in this project!', {
              bulkNumber: queryCount,
            })}
      </strong>
    </p>
  );
};

type Props = {
  api: Client;
  allResultsVisible: boolean;
  organization: Organization;
  orgId: string;
  selection: GlobalSelection;
  groupIds: string[];
  onRealtimeChange: (realtime: boolean) => void;
  onSelectStatsPeriod: (period: string) => void;
  realtimeActive: boolean;
  statsPeriod: string;
  query: string;
  queryCount: number;
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

const IssueListActions = createReactClass<Props, State>({
  displayName: 'IssueListActions',

  propTypes: {
    api: PropTypes.object,
    allResultsVisible: PropTypes.bool,
    organization: SentryTypes.Organization.isRequired,
    orgId: PropTypes.string.isRequired,
    selection: SentryTypes.GlobalSelection.isRequired,
    groupIds: PropTypes.instanceOf(Array).isRequired,
    onRealtimeChange: PropTypes.func.isRequired,
    onSelectStatsPeriod: PropTypes.func.isRequired,
    realtimeActive: PropTypes.bool.isRequired,
    statsPeriod: PropTypes.string.isRequired,
    query: PropTypes.string.isRequired,
    queryCount: PropTypes.number,
  },

  mixins: [Reflux.listenTo(SelectedGroupStore, 'handleSelectedGroupChange') as any],

  getInitialState() {
    return {
      datePickerActive: false,
      anySelected: false,
      multiSelected: false, // more than one selected
      pageSelected: false, // all on current page selected (e.g. 25)
      allInQuerySelected: false, // all in current search query selected (e.g. 1000+)
      selectedIds: new Set(),
    };
  },

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
  },

  deselectAll() {
    SelectedGroupStore.deselectAll();
    this.setState({allInQuerySelected: false});
  },

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
    const selectedProjectSlug = uniqProjects.length === 1 ? uniqProjects[0] : null;

    this.setState({
      pageSelected: SelectedGroupStore.allSelected(),
      multiSelected: SelectedGroupStore.multiSelected(),
      anySelected: SelectedGroupStore.anySelected(),
      allInQuerySelected: false, // any change resets
      selectedIds: SelectedGroupStore.getSelectedIds(),
      selectedProjectSlug,
    });
  },

  handleSelectStatsPeriod(period: string) {
    return this.props.onSelectStatsPeriod(period);
  },

  handleApplyToAll() {
    this.setState({
      allInQuerySelected: true,
    });
  },

  handleUpdate(data: UpdateResolutionStatus) {
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
  },

  handleDelete() {
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
  },

  handleMerge() {
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
  },

  handleSelectAll() {
    SelectedGroupStore.toggleSelectAll();
  },

  handleRealtimeChange() {
    this.props.onRealtimeChange(!this.props.realtimeActive);
  },

  shouldConfirm(
    action:
      | 'resolve'
      | 'unresolve'
      | 'ignore'
      | 'unbookmark'
      | 'bookmark'
      | 'merge'
      | 'delete'
  ) {
    const selectedItems = SelectedGroupStore.getSelectedIds();
    switch (action) {
      case 'resolve':
      case 'unresolve':
      case 'ignore':
      case 'unbookmark':
        return this.state.pageSelected && selectedItems.size > 1;
      case 'bookmark':
        return selectedItems.size > 1;
      case 'merge':
      case 'delete':
      default:
        return true; // By default, should confirm ...
    }
  },

  renderResolveActions({
    hasReleases,
    latestRelease,
    projectId,
    confirm,
    label,
    loadingProjects,
    projectFetchError,
  }) {
    const {orgId} = this.props;
    const {anySelected} = this.state;

    // resolve requires a single project to be active in an org context
    // projectId is null when 0 or >1 projects are selected.
    const resolveDisabled = !anySelected || projectFetchError;
    const resolveDropdownDisabled =
      !(anySelected && projectId) || loadingProjects || projectFetchError;
    return (
      <ResolveActions
        hasRelease={hasReleases}
        latestRelease={latestRelease}
        orgId={orgId}
        projectId={projectId}
        onUpdate={this.handleUpdate}
        shouldConfirm={this.shouldConfirm('resolve')}
        confirmMessage={confirm('resolve', true)}
        confirmLabel={label('resolve')}
        disabled={resolveDisabled}
        disableDropdown={resolveDropdownDisabled}
        projectFetchError={projectFetchError}
      />
    );
  },

  render() {
    const {
      allResultsVisible,
      organization,
      orgId,
      queryCount,
      query,
      realtimeActive,
      selection,
      statsPeriod,
    } = this.props;
    const issues = this.state.selectedIds;
    const numIssues = issues.size;
    const {
      allInQuerySelected,
      anySelected,
      multiSelected,
      pageSelected,
      selectedProjectSlug,
    } = this.state;
    const confirm = getConfirm(numIssues, allInQuerySelected, query, queryCount);
    const label = getLabel(numIssues, allInQuerySelected);
    const hasDynamicIssueCounts = organization.features.includes('dynamic-issue-counts');

    // merges require a single project to be active in an org context
    // selectedProjectSlug is null when 0 or >1 projects are selected.
    const mergeDisabled = !(multiSelected && selectedProjectSlug);

    return (
      <Sticky>
        <StyledFlex>
          <ActionsCheckbox>
            <Checkbox onChange={this.handleSelectAll} checked={pageSelected} />
          </ActionsCheckbox>
          <ActionSet>
            {selectedProjectSlug ? (
              <Projects orgId={orgId} slugs={[selectedProjectSlug]}>
                {({projects, initiallyLoaded, fetchError}) => {
                  const selectedProject = projects[0];
                  return this.renderResolveActions({
                    hasReleases: selectedProject.hasOwnProperty('features')
                      ? (selectedProject as Project).features.includes('releases')
                      : false,
                    latestRelease: selectedProject.hasOwnProperty('latestRelease')
                      ? (selectedProject as Project).latestRelease
                      : undefined,
                    projectId: selectedProject.slug,
                    confirm,
                    label,
                    loadingProjects: !initiallyLoaded,
                    projectFetchError: !!fetchError,
                  });
                }}
              </Projects>
            ) : (
              this.renderResolveActions({
                hasReleases: false,
                latestRelease: null,
                projectId: null,
                confirm,
                label,
              })
            )}
            <IgnoreActions
              onUpdate={this.handleUpdate}
              shouldConfirm={this.shouldConfirm('ignore')}
              confirmMessage={confirm('ignore', true)}
              confirmLabel={label('ignore')}
              disabled={!anySelected}
            />
            <div className="btn-group hidden-md hidden-sm hidden-xs">
              <ActionLink
                className="btn btn-default btn-sm action-merge"
                disabled={mergeDisabled}
                onAction={this.handleMerge}
                shouldConfirm={this.shouldConfirm('merge')}
                message={confirm('merge', false)}
                confirmLabel={label('merge')}
                title={t('Merge Selected Issues')}
              >
                {t('Merge')}
              </ActionLink>
            </div>
            <div className="btn-group">
              <DropdownLink
                key="actions"
                caret={false}
                className="btn btn-sm btn-default action-more"
                title={
                  <IconPad>
                    <IconEllipsis size="xs" />
                  </IconPad>
                }
              >
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-merge hidden-lg hidden-xl"
                    disabled={mergeDisabled}
                    onAction={this.handleMerge}
                    shouldConfirm={this.shouldConfirm('merge')}
                    message={confirm('merge', false)}
                    confirmLabel={label('merge')}
                    title={t('Merge Selected Issues')}
                  >
                    {t('Merge')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider className="hidden-lg hidden-xl" />
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-bookmark"
                    disabled={!anySelected}
                    onAction={() => this.handleUpdate({isBookmarked: true})}
                    shouldConfirm={this.shouldConfirm('bookmark')}
                    message={confirm('bookmark', false)}
                    confirmLabel={label('bookmark')}
                    title={t('Add to Bookmarks')}
                  >
                    {t('Add to Bookmarks')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider />
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-remove-bookmark"
                    disabled={!anySelected}
                    onAction={() => this.handleUpdate({isBookmarked: false})}
                    shouldConfirm={this.shouldConfirm('unbookmark')}
                    message={confirm('remove', false, ' from your bookmarks')}
                    confirmLabel={label('remove', ' from your bookmarks')}
                    title={t('Remove from Bookmarks')}
                  >
                    {t('Remove from Bookmarks')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider />
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-unresolve"
                    disabled={!anySelected}
                    onAction={() => this.handleUpdate({status: 'unresolved'})}
                    shouldConfirm={this.shouldConfirm('unresolve')}
                    message={confirm('unresolve', true)}
                    confirmLabel={label('unresolve')}
                    title={t('Set status to: Unresolved')}
                  >
                    {t('Set status to: Unresolved')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider />
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-delete"
                    disabled={!anySelected}
                    onAction={this.handleDelete}
                    shouldConfirm={this.shouldConfirm('delete')}
                    message={confirm('delete', false)}
                    confirmLabel={label('delete')}
                    title={t('Delete Issues')}
                  >
                    {t('Delete Issues')}
                  </ActionLink>
                </MenuItem>
              </DropdownLink>
            </div>
            <div className="btn-group">
              <Tooltip
                title={t(
                  '%s real-time updates',
                  realtimeActive ? t('Pause') : t('Enable')
                )}
              >
                <a
                  data-test-id="realtime-control"
                  className="btn btn-default btn-sm hidden-xs"
                  onClick={this.handleRealtimeChange}
                >
                  <IconPad>
                    {realtimeActive ? <IconPause size="xs" /> : <IconPlay size="xs" />}
                  </IconPad>
                </a>
              </Tooltip>
            </div>
          </ActionSet>
          <GraphHeaderWrapper className="hidden-xs hidden-sm">
            <GraphHeader>
              <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
              <GraphToggle
                active={statsPeriod === '24h'}
                onClick={this.handleSelectStatsPeriod.bind(this, '24h')}
              >
                {t('24h')}
              </GraphToggle>
              {hasDynamicIssueCounts ? (
                <GraphToggle
                  active={statsPeriod === 'auto'}
                  onClick={this.handleSelectStatsPeriod.bind(this, 'auto')}
                >
                  {selection.datetime.period || t('Custom')}
                </GraphToggle>
              ) : (
                <GraphToggle
                  active={statsPeriod === '14d'}
                  onClick={this.handleSelectStatsPeriod.bind(this, '14d')}
                >
                  {t('14d')}
                </GraphToggle>
              )}
            </GraphHeader>
          </GraphHeaderWrapper>
          {hasDynamicIssueCounts ? (
            <React.Fragment>
              <EventsOrUsersLabel className="align-right">
                {t('Events')}
              </EventsOrUsersLabel>
              <EventsOrUsersLabel className="align-right">
                {t('Users')}
              </EventsOrUsersLabel>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <EventsOrUsersLabel className="align-right">
                {t('Events')}
                <StyledQuestionTooltip
                  title={t('Number of events since the issue was created')}
                  size="xs"
                  position="top"
                />
              </EventsOrUsersLabel>
              <EventsOrUsersLabel className="align-right">
                {t('Users')}
                <StyledQuestionTooltip
                  title={t('Unique users affected since the issue was created')}
                  size="xs"
                  position="top"
                />
              </EventsOrUsersLabel>
            </React.Fragment>
          )}
          <AssigneesLabel className="align-right hidden-xs hidden-sm">
            <ToolbarHeader>{t('Assignee')}</ToolbarHeader>
          </AssigneesLabel>
        </StyledFlex>

        {!allResultsVisible && pageSelected && (
          <div className="row stream-select-all-notice">
            <div className="col-md-12">
              {allInQuerySelected ? (
                <strong>
                  {queryCount >= BULK_LIMIT
                    ? tct(
                        'Selected up to the first [count] issues that match this search query.',
                        {
                          count: BULK_LIMIT_STR,
                        }
                      )
                    : tct('Selected all [count] issues that match this search query.', {
                        count: queryCount,
                      })}
                </strong>
              ) : (
                <span>
                  {tn(
                    '%s issue on this page selected.',
                    '%s issues on this page selected.',
                    numIssues
                  )}
                  <a onClick={this.handleApplyToAll}>
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
                </span>
              )}
            </div>
          </div>
        )}
      </Sticky>
    );
  },
});

const Sticky = styled('div')`
  position: sticky;
  z-index: ${p => p.theme.zIndex.header};
  top: -1px;
`;

const StyledFlex = styled('div')`
  display: flex;
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
  align-items: center;
  background: ${p => p.theme.gray100};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  margin-bottom: -1px;
`;

const ActionsCheckbox = styled('div')`
  padding-left: ${space(2)};
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const ActionSet = styled('div')`
  @media (min-width: ${theme.breakpoints[0]}) {
    width: 66.66%;
  }
  @media (min-width: ${theme.breakpoints[2]}) {
    width: 50%;
  }
  flex: 1;
  margin-left: ${space(1)};
  margin-right: ${space(1)};

  display: flex;

  .btn-group {
    display: flex;
    margin-right: 6px;
  }
`;

const GraphHeaderWrapper = styled('div')`
  width: 160px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};
`;

const GraphHeader = styled('div')`
  display: flex;
`;

const StyledToolbarHeader = styled(ToolbarHeader)`
  flex: 1;
`;

const GraphToggle = styled('a')<{active: boolean}>`
  font-size: 13px;
  padding-left: 8px;

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.gray700 : p.theme.disabled)};
  }
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const EventsOrUsersLabel = styled(ToolbarHeader)`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(0.5)};
  align-items: center;

  margin-left: ${space(1.5)};
  margin-right: ${space(1.5)};
  @media (min-width: ${theme.breakpoints[0]}) {
    width: 60px;
  }
  @media (min-width: ${theme.breakpoints[1]}) {
    width: 60px;
  }
  @media (min-width: ${theme.breakpoints[2]}) {
    width: 80px;
    margin-left: ${space(2)};
    margin-right: ${space(2)};
  }
`;

const AssigneesLabel = styled('div')`
  width: 80px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};
`;

// New icons are misaligned inside bootstrap buttons.
// This is a shim that can be removed when buttons are upgraded
// to styled components.
const IconPad = styled('span')`
  position: relative;
  top: ${space(0.25)};
`;

export {IssueListActions};

export default withApi(IssueListActions);
