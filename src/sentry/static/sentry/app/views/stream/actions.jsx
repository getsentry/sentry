import PropTypes from 'prop-types';
import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import Reflux from 'reflux';

import ApiMixin from '../../mixins/apiMixin';
import TooltipMixin from '../../mixins/tooltip';
import ActionLink from './actionLink';
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

const getConfirm = (action, numIssues, allInQuerySelected, query) => {
  let question = allInQuerySelected
    ? getBulkConfirmMessage(action)
    : tn(
        `Are you sure you want to ${action} this %d issue?`,
        `Are you sure you want to ${action} these %d issues`,
        numIssues
      );

  return (
    <div>
      <p style={{marginBottom: '20px'}}>
        <strong>{question}</strong>
      </p>
      <ExtraDescription all={allInQuerySelected} query={query} />
    </div>
  );
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

const StreamActions = React.createClass({
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

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip',
      placement: 'bottom',
      container: 'body',
      constraints: [
        {
          attachment: 'together',
        },
      ],
    }),
    Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange'),
    PureRenderMixin,
  ],

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
    };
  },

  componentWillReceiveProps({realtimeActive}) {
    // Need to re-attach tooltips
    if (this.props.realtimeActive !== realtimeActive) {
      this.removeTooltips();
      this.attachTooltips();
    }
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
      case 'ignore':
        return this.state.pageSelected && selectedItems.size > 1;
      default:
        // By default, should confirm ...
        return true;
    }
  },

  render() {
    // TODO(mitsuhiko): very unclear how to translate this
    let issues = SelectedGroupStore.getSelectedIds();
    let numIssues = issues.size;
    let {allInQuerySelected} = this.state;
    let extraDescription = (
      <ExtraDescription all={this.state.allInQuerySelected} query={this.props.query} />
    );

    let resolveBulkConfirmMessage = getConfirm(
      'resolve',
      numIssues,
      allInQuerySelected,
      this.props.query
    );

    let ignoreBulkConfirmMessage = getConfirm(
      'ignore',
      numIssues,
      allInQuerySelected,
      this.props.query
    );

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
              confirmMessage={resolveBulkConfirmMessage}
              disabled={!this.state.anySelected}
            />
            <IgnoreActions
              onUpdate={this.onUpdate}
              shouldConfirm={this.shouldConfirm('ignore')}
              confirmMessage={ignoreBulkConfirmMessage}
              disabled={!this.state.anySelected}
            />
            <div className="btn-group">
              <ActionLink
                className="btn btn-default btn-sm action-bookmark"
                disabled={!this.state.anySelected}
                onAction={this.onUpdate.bind(this, {isBookmarked: true})}
                buttonTitle={t('Bookmark')}
                extraDescription={extraDescription}
                confirmationQuestion={
                  this.state.allInQuerySelected
                    ? getBulkConfirmMessage('bookmark')
                    : count =>
                        tn(
                          'Are you sure you want to bookmark this %d issue?',
                          'Are you sure you want to bookmark these %d issues?',
                          count
                        )
                }
                confirmLabel={
                  this.state.allInQuerySelected
                    ? t('Bulk bookmark issues')
                    : count =>
                        tn(
                          'Bookmark %d selected issue',
                          'Bookmark %d selected issues',
                          count
                        )
                }
                tooltip={t('Add to Bookmarks')}
                onlyIfBulk={true}
                selectAllActive={this.state.pageSelected}
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
                    className="action-merge"
                    disabled={!this.state.anySelected}
                    onAction={this.onMerge}
                    extraDescription={extraDescription}
                    confirmationQuestion={
                      this.state.allInQuerySelected
                        ? getBulkConfirmMessage('merge')
                        : count =>
                            tn(
                              'Are you sure you want to merge %d issue?',
                              'Are you sure you want to merge %d issues?',
                              count
                            )
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Bulk merge issues')
                        : count =>
                            tn(
                              'Merge %d selected issue',
                              'Merge %d selected issues',
                              count
                            )
                    }
                    selectAllActive={this.state.pageSelected}
                  >
                    {t('Merge Issues')}
                  </ActionLink>
                </MenuItem>
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-remove-bookmark"
                    disabled={!this.state.anySelected}
                    onAction={this.onUpdate.bind(this, {isBookmarked: false})}
                    extraDescription={extraDescription}
                    confirmationQuestion={
                      this.state.allInQuerySelected
                        ? getBulkConfirmMessage('remove', {
                            append: ' from your bookmarks',
                          })
                        : count =>
                            tn(
                              'Are you sure you want to remove this %d issue from your bookmarks?',
                              'Are you sure you want to remove these %d issues from your bookmarks?',
                              count
                            )
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Bulk remove issues from bookmarks')
                        : count =>
                            tn(
                              'Remove %d selected issue from bookmarks',
                              'Remove %d selected issues from bookmarks',
                              count
                            )
                    }
                    onlyIfBulk={true}
                    selectAllActive={this.state.pageSelected}
                  >
                    {t('Remove from Bookmarks')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-unresolve"
                    disabled={!this.state.anySelected}
                    onAction={this.onUpdate.bind(this, {status: 'unresolved'})}
                    extraDescription={extraDescription}
                    confirmationQuestion={
                      this.state.allInQuerySelected
                        ? getBulkConfirmMessage('unresolve')
                        : count =>
                            tn(
                              'Are you sure you want to unresolve this %d issue?',
                              'Are you sure you want to unresolve these %d issues?',
                              count
                            )
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Bulk unresolve issues')
                        : count =>
                            tn(
                              'Unresolve %d selected issue',
                              'Unresolve %d selected issues',
                              count
                            )
                    }
                    onlyIfBulk={true}
                    selectAllActive={this.state.pageSelected}
                    groupIds={this.props.groupIds}
                  >
                    {t('Set status to: Unresolved')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-delete"
                    disabled={!this.state.anySelected || this.state.allInQuerySelected}
                    onAction={this.onDelete}
                    extraDescription={extraDescription}
                    confirmationQuestion={count =>
                      tn(
                        'Are you sure you want to delete %d issue?',
                        'Are you sure you want to delete %d issues?',
                        count
                      )}
                    confirmLabel={count =>
                      tn('Delete %d selected issue', 'Delete %d selected issues', count)}
                    selectAllActive={this.state.pageSelected}
                  >
                    {t('Delete Issues')}
                  </ActionLink>
                </MenuItem>
              </DropdownLink>
            </div>

            <div className="btn-group">
              <a
                className="btn btn-default btn-sm hidden-xs realtime-control tip"
                title={`${this.props.realtimeActive
                  ? 'Pause'
                  : 'Enable'} real-time updates`}
                onClick={this.onRealtimeChange}
              >
                {this.props.realtimeActive ? (
                  <span className="icon icon-pause" />
                ) : (
                  <span className="icon icon-play" />
                )}
              </a>
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
