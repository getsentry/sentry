var React = require("react");
var Reflux = require("reflux");

var api = require("../../api");
var ActionLink = require("./actionLink");
var GroupStore = require("../../stores/groupStore");
var DropdownLink = require("../../components/dropdownLink");
var IndicatorStore = require("../../stores/indicatorStore");
var MenuItem = require("../../components/menuItem");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
var SelectedGroupStore = require("../../stores/selectedGroupStore");

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

  getDefaultProps() {
    return {
      actionTypes: {
        ALL: 'all',
        SELECTED: 'selected'
      }
    };
  },

  selectStatsPeriod(period) {
    return this.props.onSelectStatsPeriod(period);
  },

  actionSelectedGroups(actionType, callback, data) {
    var selectedIds;

    if (actionType === this.props.actionTypes.ALL) {
      selectedIds = this.props.groupIds;
    } else if (actionType === this.props.actionTypes.SELECTED) {
      var itemIdSet = SelectedGroupStore.getSelectedIds();
      selectedIds = this.props.groupIds.filter(
        (itemId) => itemIdSet.has(itemId)
      );
    } else {
      throw new Exception('Invalid selector: ' + groupIds);
    }

    callback(selectedIds);

    SelectedGroupStore.deselectAll();
  },

  onUpdate(data, event, actionType) {
    this.actionSelectedGroups(actionType, (itemIds) => {
      var loadingIndicator = IndicatorStore.add('Saving changes..');

      api.bulkUpdate({
        orgId: this.props.orgId,
        projectId: this.props.projectId,
        itemIds: itemIds,
        data: data
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

  onRealtimeChange(event) {
    this.props.onRealtimeChange(!this.props.realtimeActive);
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
               actionTypes={this.props.actionTypes}
               className="btn btn-default btn-sm action-resolve"
               disabled={!this.state.anySelected}
               onAction={this.onUpdate.bind(this, {status: "resolved"})}
               buttonTitle="Resolve"
               confirmLabel="Resolve"
               canActionAll={true}
               onlyIfBulk={true}
               selectAllActive={this.state.selectAllActive}
               groupIds={this.props.groupIds}>
              <i aria-hidden="true" className="icon-checkmark"></i>
            </ActionLink>
            <ActionLink
               actionTypes={this.props.actionTypes}
               className="btn btn-default btn-sm action-bookmark"
               disabled={!this.state.anySelected}
               onAction={this.onUpdate.bind(this, {isBookmarked: true})}
               neverConfirm={true}
               buttonTitle="Bookmark"
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
                   actionTypes={this.props.actionTypes}
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
                   actionTypes={this.props.actionTypes}
                   className="action-remove-bookmark"
                   disabled={!this.state.anySelected}
                   onAction={this.onUpdate.bind(this, {isBookmarked: false})}
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
                   actionTypes={this.props.actionTypes}
                   className="action-unresolve"
                   disabled={!this.state.anySelected}
                   onAction={this.onUpdate.bind(this, {status: "unresolved"})}
                   neverConfirm={true}
                   confirmLabel="Unresolve"
                   onlyIfBulk={false}
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   groupIds={this.props.groupIds}>
                  Set status to: Unresolved
                </ActionLink>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <ActionLink
                   actionTypes={this.props.actionTypes}
                   className="action-mute"
                   disabled={!this.state.anySelected}
                   onAction={this.onUpdate.bind(this, {status: "muted"})}
                   neverConfirm={true}
                   confirmLabel="Mute"
                   onlyIfBulk={false}
                   canActionAll={false}
                   selectAllActive={this.state.selectAllActive}
                   groupIds={this.props.groupIds}>
                  Set status to: Muted
                </ActionLink>
              </MenuItem>
              <MenuItem divider={true} />
              <MenuItem noAnchor={true}>
                <ActionLink
                   actionTypes={this.props.actionTypes}
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
               onClick={this.onRealtimeChange}>
              {(this.props.realtimeActive ?
                <span className="icon icon-pause"></span>
                :
                <span className="icon icon-play"></span>
              )}
            </a>
          </div>
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
