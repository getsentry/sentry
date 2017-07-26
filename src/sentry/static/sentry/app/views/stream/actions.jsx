import React from 'react';
import Reflux from 'reflux';
import ApiMixin from '../../mixins/apiMixin';
import TooltipMixin from '../../mixins/tooltip';
import ActionLink from './actionLink';
import DropdownLink from '../../components/dropdownLink';
import Duration from '../../components/duration';
import IndicatorStore from '../../stores/indicatorStore';
import MenuItem from '../../components/menuItem';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import {t, tn} from '../../locale';
import {getShortVersion} from '../../utils';

import CustomIgnoreCountModal from '../../components/customIgnoreCountModal';
import CustomIgnoreDurationModal from '../../components/customIgnoreDurationModal';
import CustomResolutionModal from '../../components/customResolutionModal';

const IgnoreActions = React.createClass({
  propTypes: {
    anySelected: React.PropTypes.bool.isRequired,
    allInQuerySelected: React.PropTypes.bool.isRequired,
    pageSelected: React.PropTypes.bool.isRequired,
    onUpdate: React.PropTypes.func.isRequired,
    query: React.PropTypes.string
  },

  getInitialState() {
    return {
      modal: false
    };
  },

  getIgnoreDurations() {
    return [30, 120, 360, 60 * 24, 60 * 24 * 7];
  },

  getIgnoreCounts() {
    return [100, 1000, 10000, 100000];
  },

  getIgnoreWindows() {
    return [[1, 'per hour'], [24, 'per day'], [24 * 7, 'per week']];
  },

  onCustomIgnore(statusDetails) {
    this.setState({
      modal: false
    });
    this.onIgnore(statusDetails);
  },

  onIgnore(statusDetails) {
    return this.props.onUpdate({
      status: 'ignored',
      statusDetails: statusDetails || {}
    });
  },

  render() {
    let extraDescription = null;
    if (this.state.allInQuerySelected) {
      extraDescription = this.props.query
        ? <div>
            <p>{t('This will apply to the current search query:')}</p>
            <pre>{this.props.query}</pre>
          </div>
        : <p className="error">
            <strong>{t('This will apply to ALL issues in this project!')}</strong>
          </p>;
    }
    let linkClassName = 'group-ignore btn btn-default btn-sm';
    let actionLinkProps = {
      onlyIfBulk: true,
      disabled: !this.props.anySelected,
      selectAllActive: this.props.pageSelected,
      extraDescription: extraDescription,
      buttonTitle: t('Ignore'),
      confirmationQuestion: this.state.allInQuerySelected
        ? t('Are you sure you want to ignore all issues matching this search query?')
        : count =>
            tn(
              'Are you sure you want to ignore this %d issue?',
              'Are you sure you want to ignore these %d issues?',
              count
            ),
      confirmLabel: this.props.allInQuerySelected
        ? t('Ignore all issues')
        : count => tn('Ignore %d selected issue', 'Ignore %d selected issues', count)
    };
    return (
      <div style={{display: 'inline-block'}}>
        <CustomIgnoreDurationModal
          show={this.state.modal === 'duration'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore the selected issue(s) until they occur after ..')}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'count'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore the selected issue(s) until they occur again .. ')}
          countLabel={t('Number of times')}
          countName="ignoreCount"
          windowName="ignoreWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'users'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore the selected issue(s) until they affect an additional .. ')}
          countLabel={t('Numbers of users')}
          countName="ignoreUserCount"
          windowName="ignoreUserWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <div className="btn-group">
          <ActionLink
            onAction={() => this.props.onUpdate({status: 'ignored'})}
            className={linkClassName}
            {...actionLinkProps}>
            <span className="icon-ban" style={{marginRight: 5}} />
            {t('Ignore')}
          </ActionLink>
          <DropdownLink
            caret={true}
            className={linkClassName}
            title=""
            disabled={!this.props.anySelected}>
            <MenuItem header={true}>Ignore Until</MenuItem>
            <li className="dropdown-submenu">
              <DropdownLink title="This occurs again after .." caret={false}>
                {this.getIgnoreDurations().map(duration => {
                  return (
                    <MenuItem noAnchor={true} key={duration}>
                      <ActionLink
                        onAction={this.onIgnore.bind(this, {
                          ignoreDuration: duration
                        })}
                        {...actionLinkProps}>
                        <Duration seconds={duration * 60} />
                      </ActionLink>
                    </MenuItem>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'duration'})}>
                    {t('Custom')}
                  </a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink title="This occurs again .." caret={false}>
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={t('%s times', count.toLocaleString())}
                        caret={false}>
                        <MenuItem noAnchor={true}>
                          <ActionLink
                            onAction={this.onIgnore.bind(this, {
                              ignoreCount: count
                            })}
                            {...actionLinkProps}>
                            {t('from now')}
                          </ActionLink>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor={true} key={hours}>
                              <ActionLink
                                onAction={this.onIgnore.bind(this, {
                                  ignoreCount: count,
                                  ignoreWindow: hours
                                })}
                                {...actionLinkProps}>
                                {label}
                              </ActionLink>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'count'})}>
                    {t('Custom')}
                  </a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink title="This affects an additional .." caret={false}>
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={t('%s users', count.toLocaleString())}
                        caret={false}>
                        <MenuItem noAnchor={true}>
                          <ActionLink
                            onAction={this.onIgnore.bind(this, {
                              ignoreUserCount: count
                            })}
                            {...actionLinkProps}>
                            {t('from now')}
                          </ActionLink>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor={true} key={hours}>
                              <ActionLink
                                onAction={this.onIgnore.bind(this, {
                                  ignoreUserCount: count,
                                  ignoreUserWindow: hours
                                })}
                                {...actionLinkProps}>
                                {label}
                              </ActionLink>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'users'})}>
                    {t('Custom')}
                  </a>
                </MenuItem>
              </DropdownLink>
            </li>
          </DropdownLink>
        </div>
      </div>
    );
  }
});

const ResolveActions = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    hasRelease: React.PropTypes.bool.isRequired,
    latestRelease: React.PropTypes.object,
    anySelected: React.PropTypes.bool.isRequired,
    allInQuerySelected: React.PropTypes.bool.isRequired,
    pageSelected: React.PropTypes.bool.isRequired,
    onUpdate: React.PropTypes.func.isRequired,
    query: React.PropTypes.string
  },

  getInitialState() {
    return {
      modal: false
    };
  },

  onCustomResolution(statusDetails) {
    this.setState({
      modal: false
    });
    this.props.onUpdate({
      status: 'resolved',
      statusDetails: statusDetails
    });
  },

  render() {
    let {hasRelease, latestRelease, projectId, orgId} = this.props;
    let extraDescription = null;
    if (this.state.allInQuerySelected) {
      extraDescription = this.props.query
        ? (<div>
            <p>{t('This will apply to the current search query:')}</p>
            <pre>{this.props.query}</pre>
          </div>)
        : (<p className="error">
            <strong>{t('This will apply to ALL issues in this project!')}</strong>
          </p>);
    }
    let linkClassName = 'group-resolve btn btn-default btn-sm';
    let actionLinkProps = {
      onlyIfBulk: true,
      disabled: !this.props.anySelected,
      selectAllActive: this.props.pageSelected,
      extraDescription: extraDescription,
      buttonTitle: t('Resolve'),
      confirmationQuestion: this.state.allInQuerySelected
        ? t('Are you sure you want to resolve all issues matching this search query?')
        : count =>
            tn(
              'Are you sure you want to resolve this %d issue?',
              'Are you sure you want to resolve these %d issues?',
              count
            ),
      confirmLabel: this.props.allInQuerySelected
        ? t('Ignore all issues')
        : count => tn('Resolve %d selected issue', 'Resolve %d selected issues', count)
    };
    return (
      <div style={{display: 'inline-block'}}>
        <CustomResolutionModal
          show={this.state.modal}
          onSelected={this.onCustomResolution}
          onCanceled={() => this.setState({modal: false})}
          orgId={orgId}
          projectId={projectId}
        />
        <div className="btn-group">
          <ActionLink
            onAction={() => this.props.onUpdate({status: 'resolved'})}
            className={linkClassName}
            {...actionLinkProps}>
            <span className="icon-checkmark" style={{marginRight: 5}} />
            {t('Resolve')}
          </ActionLink>
          <DropdownLink
            key="resolve-dropdown"
            caret={true}
            className={linkClassName}
            title=""
            disabled={!this.props.anySelected}>
            <MenuItem header={true}>{t('Resolved In')}</MenuItem>
            <MenuItem noAnchor={true}>
              <ActionLink
                onAction={() =>
                  this.props.onUpdate({
                    status: 'resolved',
                    statusDetails: {inNextRelease: true}
                  })}
                {...actionLinkProps}>
                {t('The next release')}
              </ActionLink>
              <ActionLink
                onAction={() =>
                  this.props.onUpdate({
                    status: 'resolved',
                    statusDetails: {
                      inRelease: latestRelease ? latestRelease.version : 'latest'
                    }
                  })}
                {...actionLinkProps}>
                {latestRelease
                  ? t('The current release (%s)', getShortVersion(latestRelease.version))
                  : t('The current release')}
              </ActionLink>
              <a onClick={() => hasRelease && this.setState({modal: true})}>
                {t('Another version ...')}
              </a>
            </MenuItem>
          </DropdownLink>
        </div>
      </div>
    );
  }
});

const StreamActions = React.createClass({
  propTypes: {
    allResultsVisible: React.PropTypes.bool,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    groupIds: React.PropTypes.instanceOf(Array).isRequired,
    onRealtimeChange: React.PropTypes.func.isRequired,
    onSelectStatsPeriod: React.PropTypes.func.isRequired,
    realtimeActive: React.PropTypes.bool.isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
    query: React.PropTypes.string.isRequired,
    hasReleases: React.PropTypes.bool,
    latestRelease: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip',
      placement: 'bottom',
      container: 'body',
      constraints: [
        {
          attachment: 'together'
        }
      ]
    }),
    Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange'),
    PureRenderMixin
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
      allInQuerySelected: false // all in current search query selected (e.g. 1000+)
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
      allInQuerySelected: true
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

  onUpdate(data, event) {
    this.actionSelectedGroups(itemIds => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

      this.api.bulkUpdate(
        {
          orgId: this.props.orgId,
          projectId: this.props.projectId,
          itemIds: itemIds,
          data: data,
          query: this.props.query
        },
        {
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
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
          itemIds: itemIds,
          query: this.props.query
        },
        {
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
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
          itemIds: itemIds,
          query: this.props.query
        },
        {
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
        }
      );
    });
  },

  onSelectedGroupChange() {
    this.setState({
      pageSelected: SelectedGroupStore.allSelected(),
      multiSelected: SelectedGroupStore.multiSelected(),
      anySelected: SelectedGroupStore.anySelected(),
      allInQuerySelected: false // any change resets
    });
  },

  onSelectAll() {
    SelectedGroupStore.toggleSelectAll();
  },

  onRealtimeChange(evt) {
    this.props.onRealtimeChange(!this.props.realtimeActive);
  },

  render() {
    // TODO(mitsuhiko): very unclear how to translate this
    let numIssues = SelectedGroupStore.getSelectedIds().size;
    let extraDescription = null;
    if (this.state.allInQuerySelected) {
      extraDescription = this.props.query
        ? <div>
            <p>{t('This will apply to the current search query:')}</p>
            <pre>{this.props.query}</pre>
          </div>
        : <p className="error">
            <strong>{t('This will apply to ALL issues in this project!')}</strong>
          </p>;
    }

    return (
      <div>
        <div className="stream-actions row">
          <div className="stream-actions-left col-md-6 col-sm-8 col-xs-8">
            <div className="checkbox">
              <input
                type="checkbox"
                className="chk-select-all"
                onChange={this.onSelectAll}
                checked={this.state.pageSelected}
              />
            </div>
            <ResolveActions
              hasRelease={this.props.hasReleases}
              latestRelease={this.props.latestRelease}
              anySelected={this.state.anySelected}
              onUpdate={this.onUpdate}
              allInQuerySelected={this.state.allInQuerySelected}
              pageSelected={this.state.pageSelected}
              query={this.props.query}
              orgId={this.props.orgId}
              projectId={this.props.projectId}
            />
            <IgnoreActions
              anySelected={this.state.anySelected}
              onUpdate={this.onUpdate}
              allInQuerySelected={this.state.allInQuerySelected}
              pageSelected={this.state.pageSelected}
              query={this.props.query}
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
                    ? t(
                        'Are you sure you want to bookmark all issues matching this search query?'
                      )
                    : count =>
                        tn(
                          'Are you sure you want to bookmark this %d issue?',
                          'Are you sure you want to bookmark these %d issues?',
                          count
                        )
                }
                confirmLabel={
                  this.state.allInQuerySelected
                    ? t('Bookmark all issues')
                    : count =>
                        tn(
                          'Bookmark %d selected issue',
                          'Bookmark %d selected issues',
                          count
                        )
                }
                tooltip={t('Add to Bookmarks')}
                onlyIfBulk={true}
                selectAllActive={this.state.pageSelected}>
                <i aria-hidden="true" className="icon-star-solid" />
              </ActionLink>
            </div>
            <div className="btn-group">
              <DropdownLink
                key="actions"
                btnGroup={true}
                caret={false}
                className="btn btn-sm btn-default hidden-xs action-more"
                title={<span className="icon-ellipsis" />}>
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-merge"
                    disabled={!this.state.anySelected}
                    onAction={this.onMerge}
                    extraDescription={extraDescription}
                    confirmationQuestion={
                      this.state.allInQuerySelected
                        ? t(
                            'Are you sure you want to merge all issues matching this search query?'
                          )
                        : count =>
                            tn(
                              'Are you sure you want to merge %d issue?',
                              'Are you sure you want to merge %d issues?',
                              count
                            )
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Merge all issues')
                        : count =>
                            tn(
                              'Merge %d selected issue',
                              'Merge %d selected issues',
                              count
                            )
                    }
                    selectAllActive={this.state.pageSelected}>
                    {t('Merge Events')}
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
                        ? t(
                            'Are you sure you want to remove all issues matching this search query from your bookmarks?'
                          )
                        : count =>
                            tn(
                              'Are you sure you want to remove this %d issue from your bookmarks?',
                              'Are you sure you want to remove these %d issues from your bookmarks?',
                              count
                            )
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Remove all issues from bookmarks')
                        : count =>
                            tn(
                              'Remove %d selected issue from bookmarks',
                              'Remove %d selected issues from bookmarks',
                              count
                            )
                    }
                    onlyIfBulk={true}
                    selectAllActive={this.state.pageSelected}>
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
                        ? t(
                            'Are you sure you want to unresolve all issues matching this search query?'
                          )
                        : count =>
                            tn(
                              'Are you sure you want to unresolve this %d issue?',
                              'Are you sure you want to unresolve these %d issues?',
                              count
                            )
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Unresolve all issues')
                        : count =>
                            tn(
                              'Unresolve %d selected issue',
                              'Unresolve %d selected issues',
                              count
                            )
                    }
                    onlyIfBulk={true}
                    selectAllActive={this.state.pageSelected}
                    groupIds={this.props.groupIds}>
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
                    selectAllActive={this.state.pageSelected}>
                    {t('Delete Events')}
                  </ActionLink>
                </MenuItem>
              </DropdownLink>
            </div>

            <div className="btn-group">
              <a
                className="btn btn-default btn-sm hidden-xs realtime-control tip"
                title={`${this.props.realtimeActive ? 'Pause' : 'Enable'} real-time updates`}
                onClick={this.onRealtimeChange}>
                {this.props.realtimeActive
                  ? <span className="icon icon-pause" />
                  : <span className="icon icon-play" />}
              </a>
            </div>
          </div>
          <div className="hidden-sm stream-actions-assignee col-md-1" />
          <div className="stream-actions-level col-md-1 hidden-xs" />
          <div className="hidden-sm hidden-xs stream-actions-graph col-md-2">
            <span className="stream-actions-graph-label">{t('Graph:')}</span>
            <ul className="toggle-graph">
              <li className={this.props.statsPeriod === '24h' ? 'active' : ''}>
                <a onClick={this.selectStatsPeriod.bind(this, '24h')}>{t('24h')}</a>
              </li>
              <li className={this.props.statsPeriod === '14d' ? 'active' : ''}>
                <a onClick={this.selectStatsPeriod.bind(this, '14d')}>{t('14d')}</a>
              </li>
            </ul>
          </div>
          <div className="stream-actions-count align-right col-md-1 col-sm-2 col-xs-2">
            {t('Events')}
          </div>
          <div className="stream-actions-users align-right col-md-1 col-sm-2 col-xs-2">
            {t('Users')}
          </div>
        </div>
        {!this.props.allResultsVisible &&
          this.state.pageSelected &&
          <div className="row stream-select-all-notice">
            <div className="col-md-12">
              {this.state.allInQuerySelected
                ? <strong>{t('All issues matching this search query selected.')}</strong>
                : <span>
                    {tn(
                      '%d issue on this page selected.',
                      '%d issues on this page selected.',
                      numIssues
                    )}
                    <a onClick={this.selectAll}>
                      {t('Select all issues matching this search query.')}
                    </a>
                  </span>}
            </div>
          </div>}
      </div>
    );
  }
});

export default StreamActions;
