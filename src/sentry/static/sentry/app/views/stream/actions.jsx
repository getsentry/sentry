var React = require("react");
var Reflux = require("reflux");

var utils = require("../../utils");

var api = require("../../api");
var GroupStore = require("../../stores/groupStore");
var DateTimeField = require("../../modules/datepicker/DateTimeField");
var DropdownLink = require("../../components/dropdownLink");
var IndicatorStore = require("../../stores/indicatorStore");
var MenuItem = require("../../components/menuItem");
var Modal = require("react-bootstrap/Modal");
var OverlayMixin = require("react-bootstrap/OverlayMixin");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
var SelectedGroupStore = require("../../stores/selectedGroupStore");

var ActionTypes = {
  ALL: 'all',
  SELECTED: 'selected'
};

var ActionLink = React.createClass({
  mixins: [OverlayMixin, PureRenderMixin],

  propTypes: {
    actionLabel: React.PropTypes.string,
    groupIds: React.PropTypes.instanceOf(Array).isRequired,
    canActionAll: React.PropTypes.bool.isRequired,
    confirmLabel: React.PropTypes.string,
    disabled: React.PropTypes.bool,
    neverConfirm: React.PropTypes.bool,
    onAction: React.PropTypes.func.isRequired,
    onlyIfBulk: React.PropTypes.bool,
    selectAllActive: React.PropTypes.bool.isRequired
  },

  getDefaultProps() {
    return {
      confirmLabel: 'Edit',
      onlyIfBulk: false,
      neverConfirm: false,
      disabled: false
    };
  },

  getInitialState() {
    return {
      isModalOpen: false
    };
  },

  handleToggle() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  handleActionAll(event) {
    this.props.onAction(event, ActionTypes.ALL);
    this.setState({
      isModalOpen: false
    });
  },

  handleActionSelected(event) {
    this.props.onAction(event, ActionTypes.SELECTED);
    this.setState({
      isModalOpen: false
    });
  },

  defaultActionLabel(confirmLabel) {
    return confirmLabel.toLowerCase() + ' these {count} events';
  },

  render() {
    var className = this.props.className;
    if (this.props.disabled) {
      className += ' disabled';
    }
    return (
      <a className={className} disabled={this.props.disabled} onClick={this.handleToggle}>
        {this.props.children}
      </a>
    );
  },

  renderOverlay() {
    if (!this.state.isModalOpen) {
      return <span/>;
    }

    var selectedItemIds = SelectedGroupStore.getSelectedIds();
    if (selectedItemIds.size === 0) {
      throw new Error('ActionModal rendered without any selected groups');
    }

    var shouldConfirm = true;
    // if skipConfirm is set we never actually show the modal
    if (this.props.neverConfirm === true) {
      shouldConfirm = false;
    // if onlyIfBulk is set and we've selected a single item, we skip
    // showing the modal
    } else if (this.props.onlyIfBulk === true && !this.props.selectAllActive) {
      shouldConfirm = false;
    }

    if (!shouldConfirm) {
      this.handleActionSelected();
      this.state.isModalOpen = false;
      return null;
    }

    var confirmLabel = this.props.confirmLabel;
    var actionLabel = this.props.actionLabel || this.defaultActionLabel(confirmLabel);
    var numEvents = selectedItemIds.size;

    actionLabel = actionLabel.replace('{count}', numEvents);

    return (
      <Modal title="Please confirm" animation={false} onRequestHide={this.handleToggle}>
        <div className="modal-body">
          <p><strong>Are you sure that you want to {actionLabel}?</strong></p>
          <p>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default"
                  onClick={this.handleToggle}>Cancel</button>
          {this.props.canActionAll &&
            <button type="button" className="btn btn-danger"
                    onClick={this.handleActionAll}>{confirmLabel} all recorded events</button>
          }
          <button type="button" className="btn btn-primary"
                  onClick={this.handleActionSelected}>{confirmLabel} {numEvents} selected events</button>
        </div>
      </Modal>
    );
  }
});

var SortOptions = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    PureRenderMixin
  ],

  getInitialState() {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();

    return {
      sortKey: queryParams.sort || 'date'
    };
  },

  getMenuItem(key) {
    var router = this.context.router;
    var queryParams = $.extend({}, router.getCurrentQuery());
    var params = router.getCurrentParams();

    queryParams.sort = key;

    return (
      <MenuItem to="stream" params={params} query={queryParams}
                isActive={this.state.sortKey === key}>
        {this.getSortLabel(key)}
      </MenuItem>
    );
  },

  componentWillReceiveProps(nextProps) {
    var router = this.context.router;
    this.setState({
      sortKey: router.getCurrentQuery().sort || 'date'
    });
  },

  getSortLabel(key) {
    switch (key) {
      case 'new':
        return 'First Seen';
      case 'priority':
        return 'Priority';
      case 'freq':
        return 'Frequency';
      case 'date':
        return 'Last Seen';
    }
  },

  render() {
    var dropdownTitle = (
      <span>
        <span className="hidden-sm hidden-xs">Sort by:</span>
        &nbsp; {this.getSortLabel(this.state.sortKey)}
      </span>
    );

    return (
      <DropdownLink
          key="sort"
          className="btn btn-sm"
          btnGroup={true}
          title={dropdownTitle}>
        {this.getMenuItem('priority')}
        {this.getMenuItem('date')}
        {this.getMenuItem('new')}
        {this.getMenuItem('freq')}
      </DropdownLink>
    );
  }
});

var DateSelector = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    PureRenderMixin
  ],

  getInitialState() {
    return {
      dateFrom: null,
      dateTo: null,
      dateType: "last_seen"
    };
  },

  onClear() {
    this.setState({
      dateFrom: null,
      dateTo: null
    });
    this.onApply(e);
  },

  onDateFromChange(value) {
    this.setState({
      dateFrom: value
    });
  },

  onDateToChange(value) {
    this.setState({
      dateTo: value
    });
  },

  onDateTypeChange(value) {
    this.setState({
      dateType: value
    });
  },

  componentDidMount() {
    $(this.getDOMNode()).find('.dropdown-toggle').dropdown();
  },

  onApply(e) {
    e.preventDefault();
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();
    queryParams.until = this.state.dateTo;
    queryParams.since = this.state.dateFrom;
    queryParams.date_type = this.state.dateType;
    // TODO(dcramer): ideally we wouldn't hardcode stream here
    router.transitionTo('stream', router.getCurrentParams(), queryParams);
    $(this.getDOMNode()).find('.dropdown-toggle').dropdown('toggle');
  },

  render() {
    return (
      <div className="dropdown btn-group">
        <a className="btn btn-sm dropdown-toggle hidden-xs" data-toggle="dropdown">
          All time
          <span className="icon-arrow-down"></span>
        </a>
        <div className="datepicker-box dropdown-menu" id="daterange">
          <form method="GET">
            <div className="input">
              <DateTimeField onChange={this.onDateFromChange} />
              to
              <DateTimeField onChange={this.onDateToChange} />
              <div className="help-block">All events are represented in UTC time.</div>
            </div>
            <div className="submit">
              <div className="pull-right">
                <button className="btn btn-default btn-sm"
                        onClick={this.onClear}>Clear</button>
                <button className="btn btn-primary btn-sm"
                        onClick={this.onApply}>Apply</button>
              </div>
              <div className="radio-inputs">
                <label className="radio">
                  <input type="radio" name="date_type"
                         onChange={this.onDateTypeChange.bind(this, "last_seen")}
                         checked={this.state.dateType === "last_seen"} /> Last Seen
                </label>
                <label className="radio">
                  <input type="radio" name="date_type"
                         onChange={this.onDateTypeChange.bind(this, "first_seen")}
                         checked={this.state.dateType === "first_seen"} /> First Seen
                </label>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

var StreamActions = React.createClass({
  mixins: [
    Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange'),
    PureRenderMixin
  ],

  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    groupIds: React.PropTypes.instanceOf(Array).isRequired,
    onRealtimeChange: React.PropTypes.func.isRequired,
    onSelectStatsPeriod: React.PropTypes.func.isRequired,
    realtimeActive: React.PropTypes.bool.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      datePickerActive: false,
      selectAllActive: false,
      anySelected: false,
      multiSelected: false,
    };
  },
  selectStatsPeriod(period) {
    return this.props.onSelectStatsPeriod(period);
  },
  actionSelectedGroups(actionType, callback, data) {
    var selectedIds;

    if (actionType === ActionTypes.ALL) {
      selectedIds = this.props.groupIds;
    } else if (actionType === ActionTypes.SELECTED) {
      itemIdSet = SelectedGroupStore.getSelectedIds();
      selectedIds = this.props.groupIds.filter(
        (itemId) => itemIdSet.has(itemId)
      );
    } else {
      throw new Exception('Invalid selector: ' + groupIds);
    }

    callback(selectedIds);

    SelectedGroupStore.clearAll();
  },
  onResolve(event, actionType) {
    this.actionSelectedGroups(actionType, (itemIds) => {
      var loadingIndicator = IndicatorStore.add('Saving changes..');

      api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: {
          status: 'resolved'
        }
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },
  onBookmark(event, actionType) {
    this.actionSelectedGroups(actionType, (itemIds) => {
      var loadingIndicator = IndicatorStore.add('Saving changes..');

      api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: {
          isBookmarked: true
        }
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },
  onRemoveBookmark(event, actionType) {
    var loadingIndicator = IndicatorStore.add('Saving changes..');

    this.actionSelectedGroups(actionType, (itemIds) => {
      api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: {
          isBookmarked: false
        }
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },
  onDelete(event, actionType) {
    var loadingIndicator = IndicatorStore.add('Removing events..');

    this.actionSelectedGroups((itemIds) => {
      api.bulkDelete({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },
  onMerge(event, actionType) {
    var loadingIndicator = IndicatorStore.add('Merging events..');

    this.actionSelectedGroups(actionType, (itemIds) => {
      api.merge({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
      }, {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },
  onSelectedGroupChange() {
    this.setState({
      selectAllActive: SelectedGroupStore.allSelected(),
      multiSelected: SelectedGroupStore.multiSelected(),
      anySelected: SelectedGroupStore.anySelected()
    });
  },
  onSelectAll() {
    SelectedGroupStore.toggleSelectAll();
  },
  render() {
    return (
      <div className="stream-actions row">
        <div className="stream-actions-left col-md-7 col-sm-8 col-xs-8">
          <div className="checkbox">
            <input type="checkbox" className="chk-select-all"
                   onChange={this.onSelectAll}
                   checked={this.state.selectAllActive} />
          </div>
          <div className="btn-group">
            <ActionLink
               className="btn btn-default btn-sm action-resolve"
               disabled={!this.state.anySelected}
               onAction={this.onResolve}
               confirmLabel="Resolve"
               canActionAll={true}
               onlyIfBulk={true}
               selectAllActive={this.state.selectAllActive}
               groupIds={this.props.groupIds}>
              <i aria-hidden="true" className="icon-checkmark"></i>
            </ActionLink>
            <ActionLink
               className="btn btn-default btn-sm action-bookmark"
               disabled={!this.state.anySelected}
               onAction={this.onBookmark}
               neverConfirm={true}
               confirmLabel="Bookmark"
               canActionAll={false}
               onlyIfBulk={true}
               selectAllActive={this.state.selectAllActive}
               groupIds={this.props.groupIds}>
              <i aria-hidden="true" className="icon-bookmark"></i>
            </ActionLink>

            <DropdownLink
              key="actions"
              btnGroup={true}
              caret={false}
              disabled={!this.state.anySelected}
              className="btn btn-sm btn-default hidden-xs action-more"
              title={<span className="icon-ellipsis"></span>}>
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-merge"
                   disabled={!this.state.multiSelected}
                   onAction={this.onMerge}
                   confirmLabel="Merge"
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   groupIds={this.props.groupIds}>
                  Merge Events
                </ActionLink>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-remove-bookmark"
                   disabled={!this.state.anySelected}
                   onAction={this.onRemoveBookmark}
                   neverConfirm={true}
                   actionLabel="remove these {count} events from your bookmarks"
                   onlyIfBulk={true}
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   groupIds={this.props.groupIds}>
                  Remove from Bookmarks
                </ActionLink>
              </MenuItem>
              <MenuItem divider={true} />
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-delete"
                   disabled={!this.state.anySelected}
                   onAction={this.onDelete}
                   confirmLabel="Delete"
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   groupIds={this.props.groupIds}>
                  Delete Events
                </ActionLink>
              </MenuItem>
            </DropdownLink>
          </div>

          <div className="btn-group">
            <a className="btn btn-default btn-sm hidden-xs realtime-control"
               onClick={this.props.onRealtimeChange}>
              {(this.props.realtimeActive ?
                <span className="icon icon-pause"></span>
                :
                <span className="icon icon-play"></span>
              )}
            </a>
          </div>
          <SortOptions />
          <DateSelector />
        </div>
        <div className="hidden-sm stream-actions-assignee col-md-1">
        </div>
        <div className="hidden-sm hidden-xs stream-actions-graph col-md-2">
          <ul className="toggle-graph">
            <li className={this.props.statsPeriod === '24h' ? 'active' : ''}>
              <a onClick={this.selectStatsPeriod.bind(this, '24h')}>24h</a>
            </li>
            <li className={this.props.statsPeriod === '14d' ? 'active' : ''}>
              <a onClick={this.selectStatsPeriod.bind(this, '14d')}>14d</a>
            </li>
          </ul>
        </div>
        <div className="stream-actions-occurrences align-right col-md-1 col-sm-2 col-xs-2"> events</div>
        <div className="stream-actions-users align-right col-md-1 col-sm-2 col-xs-2"> users</div>
      </div>
    );
  }
});

module.exports = StreamActions;
