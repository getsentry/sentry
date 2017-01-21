import React from 'react';
import Reflux from 'reflux';
import ApiMixin from '../../mixins/apiMixin';
import ActionLink from './actionLink';
import DropdownLink from '../../components/dropdownLink';
import IndicatorStore from '../../stores/indicatorStore';
import MenuItem from '../../components/menuItem';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import {t, tn} from '../../locale';

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
    query: React.PropTypes.string.isRequired
  },

  mixins: [
    ApiMixin,
    Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange'),
    PureRenderMixin
  ],

  getInitialState() {
    return {
      datePickerActive: false,

      anySelected: false,
      multiSelected: false, // more than one selected
      pageSelected: false, // all on current page selected (e.g. 25)
      allInQuerySelected: false, // all in current search query selected (e.g. 1000+)
    };
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
      selectedIds = this.props.groupIds.filter(
        (itemId) => itemIdSet.has(itemId)
      );
    }

    callback(selectedIds);

    this.deselectAll();
  },

  deselectAll() {
    SelectedGroupStore.deselectAll();
    this.setState({allInQuerySelected: false});
  },

  onUpdate(data, event) {
    this.actionSelectedGroups((itemIds) => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

      this.api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: data,
        query: this.props.query
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  onDelete(event) {
    let loadingIndicator = IndicatorStore.add(t('Removing events..'));

    this.actionSelectedGroups((itemIds) => {
      this.api.bulkDelete({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        query: this.props.query
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  onMerge(event) {
    let loadingIndicator = IndicatorStore.add(t('Merging events..'));

    this.actionSelectedGroups((itemIds) => {
      this.api.merge({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        query: this.props.query
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
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
      extraDescription = (this.props.query ? (
        <div>
          <p>{t('This will apply to the current search query:')}</p>
          <pre>{this.props.query}</pre>
        </div>
      ) : (
        <p className="error"><strong>{t('This will apply to ALL issues in this project!')}</strong></p>
      ));
    }

    return (
      <div>
        <div className="stream-actions row">
          <div className="stream-actions-left col-md-6 col-sm-8 col-xs-8">
            <div className="checkbox">
              <input type="checkbox" className="chk-select-all"
                     onChange={this.onSelectAll}
                     checked={this.state.pageSelected} />
            </div>
            <div className="btn-group">
              <ActionLink
                 className="btn btn-default btn-sm action-resolve"
                 disabled={!this.state.anySelected}
                 onAction={this.onUpdate.bind(this, {status: 'resolved'})}
                 buttonTitle={t('Resolve')}
                 extraDescription={extraDescription}
                 confirmationQuestion={
                  this.state.allInQuerySelected
                    ? t('Are you sure you want to resolve all issues matching this search query?')
                    : (count) =>
                        tn('Are you sure you want to resolve this %d issue?',
                           'Are you sure you want to resolve these %d issues?',
                           count)
                 }
                 confirmLabel={
                  this.state.allInQuerySelected
                    ? t('Resolve all issues')
                    : (count) =>
                        tn('Resolve %d selected issue',
                           'Resolve %d selected issues',
                           count)
                 }
                 tooltip={t('Set Status to Resolved')}
                 onlyIfBulk={true}
                 selectAllActive={this.state.pageSelected}>
                <i aria-hidden="true" className="icon-checkmark"></i>
              </ActionLink>
              <ActionLink
                 className="btn btn-default btn-sm action-bookmark"
                 disabled={!this.state.anySelected}
                 onAction={this.onUpdate.bind(this, {isBookmarked: true})}
                 buttonTitle={t('Bookmark')}
                 extraDescription={extraDescription}
                 confirmationQuestion={
                  this.state.allInQuerySelected
                    ? t('Are you sure you want to bookmark all issues matching this search query?')
                    : (count) =>
                        tn('Are you sure you want to bookmark this %d issue?',
                           'Are you sure you want to bookmark these %d issues?',
                           count)
                 }
                 confirmLabel={
                  this.state.allInQuerySelected
                    ? t('Bookmark all issues')
                    : (count) =>
                        tn('Bookmark %d selected issue',
                           'Bookmark %d selected issues',
                            count)
                 }
                 tooltip={t('Add to Bookmarks')}
                 onlyIfBulk={true}
                 selectAllActive={this.state.pageSelected}>
                <i aria-hidden="true" className="icon-star-solid"></i>
              </ActionLink>

              <DropdownLink
                key="actions"
                btnGroup={true}
                caret={false}
                className="btn btn-sm btn-default hidden-xs action-more"
                title={<span className="icon-ellipsis"></span>}>
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-merge"
                    disabled={!this.state.anySelected}
                    onAction={this.onMerge}
                    extraDescription={extraDescription}
                    confirmationQuestion={
                      this.state.allInQuerySelected
                        ? t('Are you sure you want to merge all issues matching this search query?')
                        : (count) =>
                            tn('Are you sure you want to merge %d issue?',
                               'Are you sure you want to merge %d issues?',
                               count)
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Merge all issues')
                        : (count) =>
                            tn('Merge %d selected issue',
                               'Merge %d selected issues',
                               count)
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
                        ? t('Are you sure you want to remove all issues matching this search query from your bookmarks?')
                        : (count) =>
                            tn('Are you sure you want to remove this %d issue from your bookmarks?',
                               'Are you sure you want to remove these %d issues from your bookmarks?',
                               count)
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Remove all issues from bookmarks')
                        : (count) =>
                            tn('Remove %d selected issue from bookmarks',
                               'Remove %d selected issues from bookmarks',
                               count)
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
                        ? t('Are you sure you want to unresolve all issues matching this search query?')
                        : (count) =>
                          tn('Are you sure you want to unresolve this %d issue?',
                             'Are you sure you want to unresolve these %d issues?',
                             count)
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Unresolve all issues')
                        : (count) =>
                            tn('Unresolve %d selected issue',
                               'Unresolve %d selected issues',
                               count)
                    }
                    onlyIfBulk={true}
                    selectAllActive={this.state.pageSelected}
                    groupIds={this.props.groupIds}>
                   {t('Set status to: Unresolved')}
                  </ActionLink>
                </MenuItem>
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-ignore"
                    disabled={!this.state.anySelected}
                    onAction={this.onUpdate.bind(this, {status: 'ignored'})}
                    extraDescription={extraDescription}
                    confirmationQuestion={
                      this.state.allInQuerySelected
                        ? t('Are you sure you want to ignore all issues matching this search query?')
                        : (count) =>
                             tn('Are you sure you want to ignore this %d issue?',
                                'Are you sure you want to ignore these %d issues?',
                                count)
                    }
                    confirmLabel={
                      this.state.allInQuerySelected
                        ? t('Ignore all issues')
                        : (count) =>
                            tn('Ignore %d selected issue',
                               'Ignore %d selected issues',
                               count)
                    }
                    onlyIfBulk={true}
                    selectAllActive={this.state.pageSelected}>
                   {t('Set status to: Ignored')}
                  </ActionLink>
                </MenuItem>
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <ActionLink
                    className="action-delete"
                    disabled={!this.state.anySelected || this.state.allInQuerySelected}
                    onAction={this.onDelete}
                    extraDescription={extraDescription}
                    confirmationQuestion={
                      (count) =>
                        tn('Are you sure you want to delete %d issue?',
                           'Are you sure you want to delete %d issues?',
                           count)
                    }
                    confirmLabel={
                      (count) =>
                        tn('Delete %d selected issue',
                           'Delete %d selected issues',
                           count)
                    }
                    selectAllActive={this.state.pageSelected}>
                   {t('Delete Events')}
                  </ActionLink>
                </MenuItem>
              </DropdownLink>
            </div>

            <div className="btn-group">
              <a className="btn btn-default btn-sm hidden-xs realtime-control"
                 onClick={this.onRealtimeChange}>
                {(this.props.realtimeActive ?
                  <span className="icon icon-pause"></span>
                  :
                  <span className="icon icon-play"></span>
                )}
              </a>
            </div>
          </div>
          <div className="hidden-sm stream-actions-assignee col-md-1"></div>
          <div className="stream-actions-level col-md-1 hidden-xs"></div>
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
          <div className="stream-actions-count align-right col-md-1 col-sm-2 col-xs-2">{t('Events')}</div>
          <div className="stream-actions-users align-right col-md-1 col-sm-2 col-xs-2">{t('Users')}</div>
        </div>
        {!this.props.allResultsVisible && this.state.pageSelected &&
          <div className="row stream-select-all-notice" >
            <div className="col-md-12">
              {this.state.allInQuerySelected
                ? <strong>{t('All issues matching this search query selected.')}</strong>
                : <span>
                    {tn('%d issue on this page selected.',
                        '%d issues on this page selected.', numIssues)}
                    <a onClick={this.selectAll}>
                      {t('Select all issues matching this search query.')}
                    </a>
                  </span>
              }
            </div>
          </div>
        }
      </div>
    );
  }
});

export default StreamActions;
