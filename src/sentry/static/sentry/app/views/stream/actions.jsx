import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {capitalize} from 'lodash';

import ApiMixin from '../../mixins/apiMixin';
import DropdownLink from '../../components/dropdownLink';
import IndicatorStore from '../../stores/indicatorStore';
import MenuItem from '../../components/menuItem';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import {t, tct, tn} from '../../locale';

import Checkbox from '../../components/checkbox';
import Toolbar from '../../components/toolbar';
import ToolbarHeader from '../../components/toolbarHeader';
import ResolveActions from '../../components/actions/resolve';
import IgnoreActions from '../../components/actions/ignore';
import ActionLink from '../../components/actions/actionLink';
import Tooltip from '../../components/tooltip';

const BULK_LIMIT_STR = '1,000';

const getBulkConfirmMessage = action => {
  return tct(
    'Are you sure you want to [action] the first [bulkNumber] issues that match the search?',
    {
      action,
      bulkNumber: BULK_LIMIT_STR,
    }
  );
};

const getConfirm = (numIssues, allInQuerySelected, query) => {
  return function(action, canBeUndone, append = '') {
    let question = allInQuerySelected
      ? getBulkConfirmMessage(`${action}${append}`)
      : tn(
          `Are you sure you want to ${action} this %d issue${append}?`,
          `Are you sure you want to ${action} these %d issues${append}?`,
          numIssues
        );

    return (
      <div>
        <p style={{marginBottom: '20px'}}>
          <strong>{question}</strong>
        </p>
        <ExtraDescription all={allInQuerySelected} query={query} />
        {!canBeUndone && <p>{t('This action cannot be undone.')}</p>}
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

const ExtraDescription = ({all, query}) => {
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
        {tct(
          'This will apply to the first [bulkNumber] issues matched in this project!',
          {
            bulkNumber: BULK_LIMIT_STR,
          }
        )}
      </strong>
    </p>
  );
};

ExtraDescription.propTypes = {
  all: PropTypes.bool,
  query: PropTypes.string,
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
    let issues = this.state.selectedIds;
    let numIssues = issues.size;
    let {allInQuerySelected, anySelected, multiSelected} = this.state;
    let confirm = getConfirm(numIssues, allInQuerySelected, this.props.query);
    let label = getLabel(numIssues, allInQuerySelected);

    return (
      <div>
        <Toolbar className="stream-actions row">
          <div className="stream-actions-left col-md-6 col-sm-8 col-xs-8">
            <div className="checkbox">
              <Checkbox
                className="chk-select-all"
                onChange={this.onSelectAll}
                checked={this.state.pageSelected}
              />
            </div>
            <ResolveActions
              hasRelease={this.props.hasReleases}
              latestRelease={this.props.latestRelease}
              orgId={this.props.orgId}
              projectId={this.props.projectId}
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
            <div className="btn-group">
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
            <div className="btn-group">
              <ActionLink
                className={'btn btn-default btn-sm action-bookmark'}
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
                className="btn btn-sm btn-default hidden-xs action-more"
                title={<span className="icon-ellipsis" />}
              >
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
                    disabled={!anySelected || this.state.allInQuerySelected}
                    onAction={this.onDelete}
                    shouldConfirm={this.shouldConfirm('delete')}
                    message={confirm('delete', false)}
                    confirmLabel={label('delete')}
                    selectAllActive={this.state.pageSelected}
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
                  this.props.realtimeActive ? t('Pause') : t('Enable')
                )}
              >
                <a
                  className="btn btn-default btn-sm hidden-xs realtime-control"
                  onClick={this.onRealtimeChange}
                >
                  {this.props.realtimeActive ? (
                    <span className="icon icon-pause" />
                  ) : (
                    <span className="icon icon-play" />
                  )}
                </a>
              </Tooltip>
            </div>
          </div>
          <div className="hidden-sm stream-actions-assignee col-md-1" />
          <div className="stream-actions-level col-md-1 hidden-xs" />
          <div className="hidden-sm hidden-xs stream-actions-graph col-md-2">
            <ToolbarHeader className="stream-actions-graph-label">
              {t('Graph:')}
            </ToolbarHeader>
            <ul className="toggle-graph">
              <li className={this.props.statsPeriod === '24h' ? 'active' : ''}>
                <a onClick={this.selectStatsPeriod.bind(this, '24h')}>{t('24h')}</a>
              </li>
              <li className={this.props.statsPeriod === '14d' ? 'active' : ''}>
                <a onClick={this.selectStatsPeriod.bind(this, '14d')}>{t('14d')}</a>
              </li>
            </ul>
          </div>
          <ToolbarHeader className="stream-actions-count align-right col-md-1 col-sm-2 col-xs-2">
            {t('Events')}
          </ToolbarHeader>
          <ToolbarHeader className="stream-actions-users align-right col-md-1 col-sm-2 col-xs-2">
            {t('Users')}
          </ToolbarHeader>
        </Toolbar>

        {!this.props.allResultsVisible &&
          this.state.pageSelected && (
            <div className="row stream-select-all-notice">
              <div className="col-md-12">
                {this.state.allInQuerySelected ? (
                  <strong>
                    {tct(
                      'Selected up to the first [count] issues that match this search query.',
                      {
                        count: BULK_LIMIT_STR,
                      }
                    )}
                  </strong>
                ) : (
                  <span>
                    {tn(
                      '%d issue on this page selected.',
                      '%d issues on this page selected.',
                      numIssues
                    )}
                    <a onClick={this.selectAll}>
                      {tct(
                        'Select the first [count] issues that match this search query.',
                        {
                          count: BULK_LIMIT_STR,
                        }
                      )}
                    </a>
                  </span>
                )}
              </div>
            </div>
          )}
      </div>
    );
  },
});

export default StreamActions;
