import {Flex, Box} from 'grid-emotion';
import capitalize from 'lodash/capitalize';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {openCreateIncidentModal} from 'app/actionCreators/modal';
import {t, tct, tn} from 'app/locale';
import ActionLink from 'app/components/actions/actionLink';
import Checkbox from 'app/components/checkbox';
import DropdownLink from 'app/components/dropdownLink';
import ExternalLink from 'app/components/links/externalLink';
import Feature from 'app/components/acl/feature';
import IgnoreActions from 'app/components/actions/ignore';
import IndicatorStore from 'app/stores/indicatorStore';
import InlineSvg from 'app/components/inlineSvg';
import MenuItem from 'app/components/menuItem';
import ResolveActions from 'app/components/actions/resolve';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import SentryTypes from 'app/sentryTypes';
import ToolbarHeader from 'app/components/toolbarHeader';
import Tooltip from 'app/components/tooltip';
import withApi from 'app/utils/withApi';

const BULK_LIMIT = 1000;
const BULK_LIMIT_STR = BULK_LIMIT.toLocaleString();

const getBulkConfirmMessage = (action, queryCount) => {
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

const getConfirm = (numIssues, allInQuerySelected, query, queryCount) => {
  return function(action, canBeUndone, append = '') {
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
};

const getLabel = (numIssues, allInQuerySelected) => {
  return function(action, append = '') {
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
};

const ExtraDescription = ({all, query, queryCount}) => {
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

ExtraDescription.propTypes = {
  all: PropTypes.bool,
  query: PropTypes.string,
  queryCount: PropTypes.number,
};

const IssueListActions = createReactClass({
  displayName: 'IssueListActions',

  propTypes: {
    api: PropTypes.object,
    allResultsVisible: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    selection: SentryTypes.GlobalSelection.isRequired,
    groupIds: PropTypes.instanceOf(Array).isRequired,
    onRealtimeChange: PropTypes.func.isRequired,
    onSelectStatsPeriod: PropTypes.func.isRequired,
    realtimeActive: PropTypes.bool.isRequired,
    statsPeriod: PropTypes.string.isRequired,
    query: PropTypes.string.isRequired,
    queryCount: PropTypes.number,
    hasReleases: PropTypes.bool,
    latestRelease: PropTypes.object,
    organization: SentryTypes.Organization,
  },

  mixins: [Reflux.listenTo(SelectedGroupStore, 'handleSelectedGroupChange')],

  getDefaultProps() {
    return {
      hasReleases: false,
      latestRelease: null,
    };
  },

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

  actionSelectedGroups(callback) {
    let selectedIds;

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
    this.setState({
      pageSelected: SelectedGroupStore.allSelected(),
      multiSelected: SelectedGroupStore.multiSelected(),
      anySelected: SelectedGroupStore.anySelected(),
      allInQuerySelected: false, // any change resets
      selectedIds: SelectedGroupStore.getSelectedIds(),
    });
  },

  handleSelectStatsPeriod(period) {
    return this.props.onSelectStatsPeriod(period);
  },

  handleApplyToAll() {
    this.setState({
      allInQuerySelected: true,
    });
  },

  handleUpdate(data) {
    const {selection} = this.props;
    this.actionSelectedGroups(itemIds => {
      const loadingIndicator = IndicatorStore.add(t('Saving changes..'));

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
            IndicatorStore.remove(loadingIndicator);
          },
        }
      );
    });
  },

  handleDelete() {
    const loadingIndicator = IndicatorStore.add(t('Removing events..'));
    const {selection} = this.props;

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
            IndicatorStore.remove(loadingIndicator);
          },
        }
      );
    });
  },

  handleMerge() {
    const loadingIndicator = IndicatorStore.add(t('Merging events..'));
    const {selection} = this.props;

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
            IndicatorStore.remove(loadingIndicator);
          },
        }
      );
    });
  },

  handleCreateIncident() {
    const {organization} = this.props;
    const issues = this.state.selectedIds;
    openCreateIncidentModal({organization, issues: Array.from(issues)});
  },

  handleSelectAll() {
    SelectedGroupStore.toggleSelectAll();
  },

  handleRealtimeChange() {
    this.props.onRealtimeChange(!this.props.realtimeActive);
  },

  shouldConfirm(action) {
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

  render() {
    const {
      allResultsVisible,
      hasReleases,
      latestRelease,
      orgId,
      projectId,
      queryCount,
      query,
      realtimeActive,
      statsPeriod,
    } = this.props;
    const issues = this.state.selectedIds;
    const numIssues = issues.size;
    const {allInQuerySelected, anySelected, multiSelected, pageSelected} = this.state;
    const confirm = getConfirm(numIssues, allInQuerySelected, query, queryCount);
    const label = getLabel(numIssues, allInQuerySelected);

    // resolve and merge require a single project to be active
    // in an org context projectId is null when 0 or >1 projects are selected.
    const resolveDisabled = !anySelected;
    const resolveDropdownDisabled = !(anySelected && projectId);
    const mergeDisabled = !(multiSelected && projectId);
    const createNewIncidentDisabled = !anySelected || allInQuerySelected;

    return (
      <Sticky>
        <StyledFlex py={1}>
          <ActionsCheckbox pl={2}>
            <Checkbox onChange={this.handleSelectAll} checked={pageSelected} />
          </ActionsCheckbox>
          <ActionSet w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
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
            />
            <IgnoreActions
              onUpdate={this.handleUpdate}
              shouldConfirm={this.shouldConfirm('ignore')}
              confirmMessage={confirm('ignore', true)}
              confirmLabel={label('ignore')}
              disabled={!anySelected}
            />
            <div className="btn-group hidden-sm hidden-xs">
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
            <div className="btn-group hidden-xs">
              <ActionLink
                className="btn btn-default btn-sm action-bookmark hidden-md hidden-sm hidden-xs"
                onAction={() => this.handleUpdate({isBookmarked: true})}
                shouldConfirm={this.shouldConfirm('bookmark')}
                message={confirm('bookmark', false)}
                confirmLabel={label('bookmark')}
                title={t('Add to Bookmarks')}
                disabled={!anySelected}
              >
                <i aria-hidden="true" className="icon-star-solid" />
              </ActionLink>
            </div>

            <Feature features={['incidents']}>
              <div className="btn-group hidden-xs">
                <ActionLink
                  className="btn btn-default btn-sm hidden-sm hidden-xs"
                  title={t('Create new incident')}
                  disabled={createNewIncidentDisabled}
                  onAction={this.handleCreateIncident}
                >
                  <IncidentLabel>
                    <IncidentIcon
                      data-test-id="create-incident"
                      size="16"
                      src="icon-siren-add"
                    />
                    <CreateIncidentText className="hidden-md">
                      {t('Create Incident')}
                    </CreateIncidentText>
                  </IncidentLabel>
                </ActionLink>
              </div>
            </Feature>

            <div className="btn-group">
              <DropdownLink
                key="actions"
                btnGroup
                caret={false}
                className="btn btn-sm btn-default action-more"
                title={<span className="icon-ellipsis" />}
              >
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-merge hidden-md hidden-lg hidden-xl"
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
                <MenuItem noAnchor>
                  <ActionLink
                    className="hidden-md hidden-lg hidden-xl"
                    disabled={createNewIncidentDisabled}
                    onAction={this.handleCreateIncident}
                    title={t('Create new incident')}
                  >
                    {t('Create Incident')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider className="hidden-md hidden-lg hidden-xl" />
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-bookmark hidden-lg hidden-xl"
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
                <MenuItem divider className="hidden-lg hidden-xl" />
                <MenuItem noAnchor>
                  <ActionLink
                    className="action-remove-bookmark"
                    disabled={!anySelected}
                    onAction={() => this.handleUpdate({isBookmarked: false})}
                    shouldConfirm={this.shouldConfirm('unbookmark')}
                    message={confirm('remove', false, ' from your bookmarks')}
                    confirmLabel={label('remove', ' from your bookmarks')}
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
                    selectAllActive={pageSelected}
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
                  {realtimeActive ? (
                    <span className="icon icon-pause" />
                  ) : (
                    <span className="icon icon-play" />
                  )}
                </a>
              </Tooltip>
            </div>
          </ActionSet>
          <Box w={160} mx={2} className="hidden-xs hidden-sm">
            <Flex>
              <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
              <GraphToggle
                active={statsPeriod === '24h'}
                onClick={this.handleSelectStatsPeriod.bind(this, '24h')}
              >
                {t('24h')}
              </GraphToggle>

              <GraphToggle
                active={statsPeriod === '14d'}
                onClick={this.handleSelectStatsPeriod.bind(this, '14d')}
              >
                {t('14d')}
              </GraphToggle>
            </Flex>
          </Box>
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Events')}</ToolbarHeader>
          </Box>
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Users')}</ToolbarHeader>
          </Box>
          <Box w={80} mx={2} className="align-right hidden-xs hidden-sm">
            <ToolbarHeader>{t('Assignee')}</ToolbarHeader>
          </Box>
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

const StyledFlex = styled(Flex)`
  align-items: center;
  background: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  margin-bottom: -1px;
`;

const ActionsCheckbox = styled(Box)`
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const ActionSet = styled(Box)`
  display: flex;

  .btn-group {
    margin-right: 6px;
  }
`;

const StyledToolbarHeader = styled(ToolbarHeader)`
  flex: 1;
`;

const GraphToggle = styled('a')`
  font-size: 13px;
  padding-left: 8px;

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.gray4 : p.theme.disabled)};
  }
`;

const IncidentLabel = styled('div')`
  display: flex;
  align-items: center;
`;
const IncidentIcon = styled(InlineSvg)`
  position: relative;
  top: -1px;
`;
const CreateIncidentText = styled('span')`
  margin-left: 5px; /* consistent with other items in bar */
`;

export {IssueListActions};

export default withApi(IssueListActions);
