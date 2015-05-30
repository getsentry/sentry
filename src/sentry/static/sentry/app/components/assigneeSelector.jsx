/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var api = require("../api");
var Gravatar = require("../components/gravatar");
var GroupStore = require("../stores/groupStore");
var DropdownLink = require("./dropdownLink");
var MemberListStore = require("../stores/memberListStore");
var MenuItem = require("./menuItem");
var PropTypes = require("../proptypes");
var LoadingIndicator = require("../components/loadingIndicator");
var {compareArrays, valueIsEqual} = require("../utils");

var AssigneeSelector = React.createClass({
  mixins: [
    Reflux.listenTo(GroupStore, "onGroupChange")
  ],

  propTypes: {
    id: React.PropTypes.string.isRequired
  },

  getInitialState() {
    var group = GroupStore.getItem(this.props.id);

    return {
      assignedTo: group.assignedTo,
      memberList: MemberListStore.getAll(),
      filterQuery: '',
      loading: false
    };
  },

  componentWillReceiveProps(nextProps) {
    var loading = GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id != this.props.id || loading != this.state.loading) {
      var group = GroupStore.getItem(this.props.id);
      this.setState({
        assignedTo: group.assignedTo,
        memberList: MemberListStore.getAll(),
        loading: loading
      });
    }
  },

  // TODO(dcramer): this should check changes in member list
  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.filterQuery !== this.state.filterQuery) {
      return true;
    }
    if (nextState.loading !== this.state.loading) {
      return true;
    }
    return valueIsEqual(nextState.assignedTo, this.state.assignedTo, true);
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    var group = GroupStore.getItem(this.props.id);
    this.setState({
      assignedTo: group.assignedTo,
      loading: GroupStore.hasStatus(this.props.id, 'assignTo')
    });
  },

  assignTo(member) {
    api.assignTo({id: this.props.id, email: member.email});
    this.setState({filterQuery: '', loading: true});
  },

  clearAssignTo() {
    api.assignTo({id: this.props.id, email: ''});
    this.setState({filterQuery: '', loading: true});
  },

  onChangeFilter() {
    this.setState({
      filterQuery: event.target.value
    });
  },

  onDropdownOpen() {
    this.refs.filter.getDOMNode().focus();
  },

  onDropdownClose() {
    this.setState({
      filterQuery: ''
    });
  },

  render() {
    var loading = this.state.loading;
    var assignedTo = this.state.assignedTo;

    var className = "assignee-selector anchor-right";
    if (!assignedTo) {
      className += " unassigned";
    }

    var memberNodes = [];
    this.state.memberList.forEach(function(item){
      memberNodes.push(
        <MenuItem key={item.id}
                  disabled={!loading}
                  onSelect={this.assignTo.bind(this, item)} >
          <Gravatar email={item.email} className="avatar"
                    size={48} />
          {item.name || item.email}
        </MenuItem>
      );
    }.bind(this));

    return (
      <div className={className}>
        {loading ?
          <LoadingIndicator mini={true} />
        :
          <DropdownLink
            className="assignee-selector-toggle"
            onOpen={this.onDropdownOpen}
            onClose={this.onDropdownClose}
            title={assignedTo ?
              <Gravatar email={assignedTo.email} className="avatar"
                        size={48} />
              :
              <span className="icon-user" />
            }>
            <MenuItem noAnchor={true} key="filter">
              <input type="text" className="form-control input-sm"
                     placeholder="Filter people" ref="filter" />
            </MenuItem>
            {assignedTo ?
              <MenuItem key="clear"
                        className="clear-assignee"
                        disabled={!loading}
                        onSelect={this.clearAssignTo}>
                <span className="icon-close"/> Clear Assignee
              </MenuItem>
            : ''}
            {memberNodes}
          </DropdownLink>
        }
      </div>
    );
  }
});

module.exports = AssigneeSelector;
