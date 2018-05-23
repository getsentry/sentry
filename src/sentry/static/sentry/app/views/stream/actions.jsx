import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {capitalize} from 'lodash';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import {Link} from 'react-router';

import ApiMixin from 'app/mixins/apiMixin';
import DropdownLink from 'app/components/dropdownLink';
import IndicatorStore from 'app/stores/indicatorStore';
import MenuItem from 'app/components/menuItem';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import {t, tct, tn} from 'app/locale';

import Checkbox from 'app/components/checkbox';
import ToolbarHeader from 'app/components/toolbarHeader';
import ResolveActions from 'app/components/actions/resolve';
import IgnoreActions from 'app/components/actions/ignore';
import ActionLink from 'app/components/actions/actionLink';
import Tooltip from 'app/components/tooltip';

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
    let question = allInQuerySelected
      ? getBulkConfirmMessage(`${action}${append}`, queryCount)
      : tn(
          `Are you sure you want to ${action} this %d issue${append}?`,
          `Are you sure you want to ${action} these %d issues${append}?`,
          numIssues
        );

    let message =
      action == 'delete'
        ? tct(
            'Bulk deletion is only recommended for junk data. To clear your stream, consider resolving or ignoring. [link:When should I delete events?]',
            {
              link: (
                <Link to="https://help.sentry.io/hc/en-us/articles/360003443113-When-should-I-delete-events-" />
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
    let capitalized = capitalize(action);
    let text = allInQuerySelected
      ? t(`Bulk ${action} issues`)
      : tn(
          `${capitalized} %d selected issue`,
          `${capitalized} %d selected issues`,
          numIssues
        );

    return text + append;
  };
};

const ExtraDescription = ({all, query, queryCount}) => {
  if (!all) return null;

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

const StreamActions = createReactClass({
  displayName: 'StreamActions',

  propTypes: {
    allResultsVisible: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    groupIds: PropTypes.instanceOf(Array).isRequired,
    onRealtimeChange: PropTypes.func.isRequired,
    onSelectStatsPeriod: PropTypes.func.isRequired,
    realtimeActive: PropTypes.bool.isRequired,
    statsPeriod: PropTypes.string.isRequired,
    query: PropTypes.string.isRequired,
    queryCount: PropTypes.number,
    hasReleases: PropTypes.bool,
    latestRelease: PropTypes.object,
  },

  mixins: [ApiMixin, Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange')],

  getDefaultProps() {
    return {hasReleases: false, latestRelease: null};
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

  selectAll() {
    this.setState({
      allInQuerySelected: true,
    });
  },

  selectStatsPeriod(period) {
    return this.props.onSelectStatsPeriod(period);
  },

  actionSelectedGroups(callback) {
    let selectedIds;

    if (this.state.allInQuerySelected) {
      selectedIds = undefined; // undefined means "all"
    } else {
      let itemIdSet = SelectedGroupStore.getSelectedIds();
      selectedIds = this.props.groupIds.filter(itemId => itemIdSet.has(itemId));
    }

    callback(selectedIds);

    this.deselectAll();
  },

  deselectAll() {
    SelectedGroupStore.deselectAll();
    this.setState({allInQuerySelected: false});
  },

  onUpdate(data) {
    this.actionSelectedGroups(itemIds => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

      this.api.bulkUpdate(
        {
          orgId: this.props.orgId,
          projectId: this.props.projectId,
          itemIds,
          data,
          query: this.props.query,
        },
        {
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          },
        }
      );
    });
  },

  onDelete(event) {
    let loadingIndicator = IndicatorStore.add(t('Removing events..'));

    this.actionSelectedGroups(itemIds => {
      this.api.bulkDelete(
        {
          orgId: this.props.orgId,
          projectId: this.props.projectId,
          itemIds,
          query: this.props.query,
        },
        {
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          },
        }
      );
    });
  },

  onMerge(event) {
    let loadingIndicator = IndicatorStore.add(t('Merging events..'));

    this.actionSelectedGroups(itemIds => {
      this.api.merge(
        {
          orgId: this.props.orgId,
          projectId: this.props.projectId,
          itemIds,
          query: this.props.query,
        },
        {
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          },
        }
      );
    });
  },

  onSelectedGroupChange() {
    this.setState({
      pageSelected: SelectedGroupStore.allSelected(),
      multiSelected: SelectedGroupStore.multiSelected(),
      anySelected: SelectedGroupStore.anySelected(),
      allInQuerySelected: false, // any change resets
      selectedIds: SelectedGroupStore.getSelectedIds(),
    });
  },

  onSelectAll() {
    SelectedGroupStore.toggleSelectAll();
  },

  onRealtimeChange(evt) {
    this.props.onRealtimeChange(!this.props.realtimeActive);
  },

  shouldConfirm(action) {
    let selectedItems = SelectedGroupStore.getSelectedIds();
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
    // TODO(mitsuhiko): very unclear how to translate this
    let {
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
    let issues = this.state.selectedIds;
    let numIssues = issues.size;
    let {allInQuerySelected, anySelected, multiSelected, pageSelected} = this.state;
    let confirm = getConfirm(numIssues, allInQuerySelected, query, queryCount);
    let label = getLabel(numIssues, allInQuerySelected);

    return (
      <Sticky>
        <StyledFlex py={1}>
          <ActionsCheckbox pl={2}>
            <Checkbox onChange={this.onSelectAll} checked={pageSelected} />
          </ActionsCheckbox>
          <ActionSet w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
            <ResolveActions
              hasRelease={hasReleases}
              latestRelease={latestRelease}
              orgId={orgId}
              projectId={projectId}
              onUpdate={this.onUpdate}
              shouldConfirm={this.shouldConfirm('resolve')}
              confirmMessage={confirm('resolve', true)}
              confirmLabel={label('resolve')}
              disabled={!anySelected}
            />
            <IgnoreActions
              onUpdate={this.onUpdate}
              shouldConfirm={this.shouldConfirm('ignore')}
              confirmMessage={confirm('ignore', true)}
              confirmLabel={label('ignore')}
              disabled={!anySelected}
            />
            <div className="btn-group hidden-sm hidden-xs">
              <ActionLink
                className={'btn btn-default btn-sm action-merge'}
                disabled={!multiSelected}
                onAction={this.onMerge}
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
                className={'btn btn-default btn-sm action-bookmark hidden-sm hidden-xs'}
                onAction={() => this.onUpdate({isBookmarked: true})}
                shouldConfirm={this.shouldConfirm('bookmark')}
                message={confirm('bookmark', false)}
                confirmLabel={label('bookmark')}
                title={t('Add to Bookmarks')}
                disabled={!anySelected}
              >
                <i aria-hidden="true" className="icon-star-solid" />
              </ActionLink>
            </div>
            <div className="btn-group">
              <DropdownLink
                key="actions"
                btnGroup={true}
                caret={false}
                className="btn btn-sm btn-default action-more"
                title={<span className="icon-ellipsis" />}
              >
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className={'action-merge hidden-md hidden-lg hidden-xl'}
                    disabled={!multiSelected}
                    onAction={this.onMerge}
                    shouldConfirm={this.shouldConfirm('merge')}
                    message={confirm('merge', false)}
                    confirmLabel={label('merge')}
                    title={t('Merge Selected Issues')}
                  >
                    {t('Merge')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider={true} className={'hidden-md hidden-lg hidden-xl'} />
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className={'action-bookmark hidden-md hidden-lg hidden-xl'}
                    disabled={!anySelected}
                    onAction={() => this.onUpdate({isBookmarked: true})}
                    shouldConfirm={this.shouldConfirm('bookmark')}
                    message={confirm('bookmark', false)}
                    confirmLabel={label('bookmark')}
                    title={t('Add to Bookmarks')}
                  >
                    {t('Add to Bookmarks')}
                  </ActionLink>
                  <MenuItem divider={true} className={'hidden-md hidden-lg hidden-xl'} />
                </MenuItem>
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-remove-bookmark"
                    disabled={!anySelected}
                    onAction={() => this.onUpdate({isBookmarked: false})}
                    shouldConfirm={this.shouldConfirm('unbookmark')}
                    message={confirm('remove', false, ' from your bookmarks')}
                    confirmLabel={label('remove', ' from your bookmarks')}
                  >
                    {t('Remove from Bookmarks')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-unresolve"
                    disabled={!anySelected}
                    onAction={() => this.onUpdate({status: 'unresolved'})}
                    shouldConfirm={this.shouldConfirm('unresolve')}
                    message={confirm('unresolve', true)}
                    confirmLabel={label('unresolve')}
                  >
                    {t('Set status to: Unresolved')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-delete"
                    disabled={!anySelected}
                    onAction={this.onDelete}
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
                tooltipOptions={{container: 'body'}}
              >
                <a
                  className="btn btn-default btn-sm hidden-xs realtime-control"
                  onClick={this.onRealtimeChange}
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
                onClick={this.selectStatsPeriod.bind(this, '24h')}
              >
                {t('24h')}
              </GraphToggle>

              <GraphToggle
                active={statsPeriod === '14d'}
                onClick={this.selectStatsPeriod.bind(this, '14d')}
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

        {!allResultsVisible &&
          pageSelected && (
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
                      '%d issue on this page selected.',
                      '%d issues on this page selected.',
                      numIssues
                    )}
                    <a onClick={this.selectAll}>
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

const Sticky = styled.div`
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

const GraphToggle = styled.a`
  font-size: 13px;
  padding-left: 8px;

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.gray4 : p.theme.gray1)};
  }
`;

export default StreamActions;
