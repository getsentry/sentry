/*** @jsx React.DOM */
var React = require("react");
var $ = require("jquery");

var utils = require("../utils");

var joinClasses = require('react-bootstrap/utils/joinClasses');
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");
var Modal = require("react-bootstrap/Modal");
var OverlayMixin = require("react-bootstrap/OverlayMixin");

var ActionLink = React.createClass({
  mixins: [OverlayMixin],

  propTypes: {
    actionLabel: React.PropTypes.string,
    aggList: React.PropTypes.instanceOf(Array).isRequired,
    canActionAll: React.PropTypes.bool.isRequired,
    confirmLabel: React.PropTypes.string,
    disabled: React.PropTypes.bool,
    neverConfirm: React.PropTypes.bool,
    onAction: React.PropTypes.func.isRequired,
    onlyIfBulk: React.PropTypes.bool,
    selectAllActive: React.PropTypes.bool.isRequired
  },

  getDefaultProps: function() {
    return {
      confirmLabel: 'Edit',
      onlyIfBulk: false,
      neverConfirm: false,
      disabled: false
    };
  },

  getInitialState: function() {
    return {
      isModalOpen: false
    };
  },

  handleToggle: function() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  handleActionAll: function(event) {
    this.props.onAction(StreamActions.ALL, event);
    this.setState({
      isModalOpen: false
    });
  },

  handleActionSelected: function(event) {
    this.props.onAction(StreamActions.SELECTED, event);
    this.setState({
      isModalOpen: false
    });
  },

  defaultActionLabel: function(confirmLabel) {
    return confirmLabel.toLowerCase() + ' these {count} events';
  },

  render: function () {
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

  renderOverlay: function() {
    if (!this.state.isModalOpen) {
      return <span/>;
    }

    var selectedAggList = [];
    for (var i = 0, node; (node = this.props.aggList[i]); i++) {
      if (node.isSelected === true) {
        selectedAggList.push(node);
      }
    }

    if (selectedAggList.length === 0) {
      throw new Error('ActionModal rendered without any selected aggregates');
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
      return <span />;
    }

    var confirmLabel = this.props.confirmLabel;
    var actionLabel = this.props.actionLabel || this.defaultActionLabel(confirmLabel);
    var numEvents = selectedAggList.length;

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

var StreamActions = React.createClass({
  ALL: 'all',

  SELECTED: 'selected',

  propTypes: {
    aggList: React.PropTypes.instanceOf(Array).isRequired,
    anySelected: React.PropTypes.bool.isRequired,
    multiSelected: React.PropTypes.bool.isRequired,
    onBookmark: React.PropTypes.func.isRequired,
    onDelete: React.PropTypes.func.isRequired,
    onMerge: React.PropTypes.func.isRequired,
    onRealtimeChange: React.PropTypes.func.isRequired,
    onRemoveBookmark: React.PropTypes.func.isRequired,
    onResolve: React.PropTypes.func.isRequired,
    onSelectAll: React.PropTypes.func.isRequired,
    onSelectStatsPeriod: React.PropTypes.func.isRequired,
    realtimeActive: React.PropTypes.bool.isRequired,
    selectAllActive: React.PropTypes.bool.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },
  selectStatsPeriod: function(period) {
    return this.props.onSelectStatsPeriod(period);
  },
  render: function() {
    var params = utils.getQueryParams();
    var sortBy = params.sort || 'date';
    var sortLabel;

    switch (sortBy) {
      case 'new':
        sortLabel = 'First Seen';
        break;
      case 'priority':
        sortLabel = 'Priority';
        break;
      case 'freq':
        sortLabel = 'Frequency';
        break;
      default:
        sortLabel = 'Last Seen';
        sortBy = 'date';
    }

    return (
      <div className="stream-actions">
        <div className="stream-actions-left stream-actions-cell">
          <div className="checkbox">
            <input type="checkbox" className="chk-select-all"
                   onChange={this.props.onSelectAll}
                   checked={this.props.selectAllActive} />
          </div>
          <div className="btn-group">
            <ActionLink
               className="btn btn-default btn-sm action-resolve"
               disabled={!this.props.anySelected}
               onAction={this.props.onResolve}
               confirmLabel="Resolve"
               canActionAll={true}
               onlyIfBulk={true}
               selectAllActive={this.props.selectAllActive}
               aggList={this.props.aggList}>
              <i aria-hidden="true" className="icon-checkmark"></i>
            </ActionLink>
            <ActionLink
               className="btn btn-default btn-sm action-bookmark"
               disabled={!this.props.anySelected}
               onAction={this.props.onBookmark}
               neverConfirm={true}
               confirmLabel="Bookmark"
               canActionAll={false}
               onlyIfBulk={true}
               selectAllActive={this.props.selectAllActive}
               aggList={this.props.aggList}>
              <i aria-hidden="true" className="icon-bookmark"></i>
            </ActionLink>

            <DropdownLink
              key="actions"
              caret={false}
              disabled={!this.props.anySelected}
              className="btn-sm btn-default hidden-xs action-more"
              title={<span className="icon-ellipsis"></span>}>
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-merge"
                   disabled={!this.props.multiSelected}
                   onAction={this.props.onMerge}
                   confirmLabel="Merge"
                   canActionAll={false}
                   selectAllActive={this.props.selectAllActive}
                   aggList={this.props.aggList}>
                  Merge Events
                </ActionLink>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-remove-bookmark"
                   disabled={!this.props.anySelected}
                   onAction={this.props.onRemoveBookmark}
                   neverConfirm={true}
                   actionLabel="remove these {count} events from your bookmarks"
                   onlyIfBulk={true}
                   canActionAll={false}
                   selectAllActive={this.props.selectAllActive}
                   aggList={this.props.aggList}>
                  Remove from Bookmarks
                </ActionLink>
              </MenuItem>
              <MenuItem divider={true} />
              <MenuItem noAnchor={true}>
                <ActionLink
                   className="action-delete"
                   disabled={!this.props.anySelected}
                   onAction={this.props.onDelete}
                   confirmLabel="Delete"
                   canActionAll={false}
                   selectAllActive={this.props.selectAllActive}
                   aggList={this.props.aggList}>
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
          <DropdownLink
            key="sort"
            className="btn-sm"
            title={<span><span className="hidden-sm hidden-xs">Sort by:</span> {sortLabel}</span>}>
            <MenuItem href="?sort=priority" isActive={sortBy === 'priority'}>Priority</MenuItem>
            <MenuItem href="?sort=date" isActive={sortBy === 'date'}>Last Seen</MenuItem>
            <MenuItem href="?sort=new" isActive={sortBy === 'new'}>First Seen</MenuItem>
            <MenuItem href="?sort=freq" isActive={sortBy === 'freq'}>Occurances</MenuItem>
          </DropdownLink>

          <div className="btn-group">
            <a href="#" className="btn dropdown-toggle btn-sm" onclick="" data-toggle="dropdown">
              All time
            <span aria-hidden="true" className="icon-arrow-down"></span></a>
            <div className="datepicker-box dropdown-menu" id="daterange">
              <form method="GET" action=".">
                <div className="input">
                  <div className="inline-inputs">
                    <input data-toggle="datepicker" data-date-format="yyyy-mm-dd"name="df" className="form-control date" type="text" placeholder="Date" />
                    <input className="time form-control" type="text" name="tf" placeholder="Time" />
                    to
                    <input data-toggle="datepicker" data-date-format="yyyy-mm-dd" name="dt" className="date form-control" type="text" placeholder="Date"/>
                    <input className="time form-control" type="text" name="tt" placeholder="Time" />
                  </div>
                  <div className="help-block">All events are represented in UTC time.</div>
                </div>
                <div className="submit">
                  <div className="pull-right">
                    <button className="btn btn-default btn-sm">Clear</button>
                    <button className="btn btn-primary btn-sm">Apply</button>
                  </div>
                  <div className="radio-inputs">
                    <label className="radio">
                      <input type="radio" name="date_type" value="last_seen" /> Last Seen
                    </label>
                    <label className="radio">
                      <input type="radio" name="date_type" value="first_seen" /> First Seen
                    </label>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="hidden-sm hidden-xs stream-actions-assignee stream-actions-cell">
        </div>
        <div className="hidden-sm hidden-xs stream-actions-graph stream-actions-cell">
          <ul className="toggle-graph">
            <li className={this.props.statsPeriod === '24h' ? 'active' : ''}>
              <a onClick={this.selectStatsPeriod.bind(this, '24h')}>24h</a>
            </li>
            <li className={this.props.statsPeriod === '30d' ? 'active' : ''}>
              <a onClick={this.selectStatsPeriod.bind(this, '30d')}>30d</a>
            </li>
          </ul>
        </div>
        <div className="stream-actions-occurrences stream-actions-cell align-center hidden-xs"> events</div>
        <div className="stream-actions-users stream-actions-cell align-center hidden-xs"> users</div>
      </div>
    );
  }
});

module.exports = StreamActions;
