/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var api = require("../api");
var Gravatar = require("../components/gravatar");
var GroupListStore = require("../stores/groupStore");
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");
var PropTypes = require("../proptypes");
var LoadingIndicator = require("../components/loadingIndicator");
var {compareArrays} = require("../utils");

var AssigneeSelector = React.createClass({
  mixins: [Reflux.ListenerMixin],

  propTypes: {
    group: PropTypes.Group.isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
  },

  getInitialState() {
    return {
      filterQuery: '',
      loading: false
    };
  },

  assignTo(member) {
    api.assignTo({id: this.props.group.id, email: member.email});
    this.setState({filterQuery: '', loading: true});
  },

  clearAssignTo() {
    api.assignTo({id: this.props.group.id, email: ''});
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

  componentWillReceiveProps(nextProps) {
    var loading = GroupListStore.hasStatus(nextProps.group.id, 'assignTo');
    if (this.state.loading != loading) {
      this.setState({loading: loading});
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.group.assignedTo !== this.props.group.assignedTo) {
      return true;
    }
    if (!nextProps.group.assignedTo && this.props.group.assignedTo) {
      return true;
    }
    if (nextProps.group.assignedTo && this.props.group.assignedTo) {
      if (nextProps.group.assignedTo.email !== this.props.group.assignedTo) {
        return true;
      }
    } else if (!nextProps.group.assignedTo || !this.props.group.assignedTo) {
      return true;
    }
    if (nextState.filterQuery !== this.state.filterQuery) {
      return true;
    }
    if (nextState.loading !== this.state.loading) {
      return true;
    }
    var memberListEqual = compareArrays(this.props.memberList, nextProps.memberList, (obj, other) => {
      return obj.email === other.email;
    });
    return !memberListEqual;
  },

  render() {
    var group = this.props.group;
    var loading = this.state.loading;

    var className = "assignee-selector anchor-right";
    if (!group.assignedTo) {
      className += " unassigned";
    }

    var memberNodes = [];
    this.props.memberList.forEach(function(item){
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
            title={group.assignedTo ?
              <Gravatar email={group.assignedTo.email} className="avatar"
                        size={48} />
              :
              <span className="icon-user" />
            }>
            <MenuItem noAnchor={true} key="filter">
              <input type="text" className="form-control input-sm"
                     placeholder="Filter people" ref="filter" />
            </MenuItem>
            {group.assignedTo ?
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
