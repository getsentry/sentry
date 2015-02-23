/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var api = require("../api");
var Gravatar = require("../components/gravatar");
var GroupListStore = require("../stores/groupStore");
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");
var PropTypes = require("../proptypes");

var AssigneeSelector = React.createClass({
  mixins: [Reflux.ListenerMixin],

  propTypes: {
    group: PropTypes.Group.isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
  },

  getInitialState() {
    return {
      filterQuery: ''
    };
  },

  assignTo(member) {
    api.assignTo({id: this.props.group.id, email: member.email});
    this.setState({filterQuery: ''});
  },

  clearAssignTo() {
    api.assignTo({id: this.props.group.id, email: ''});
    this.setState({filterQuery: ''});
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
    var group = this.props.group;
    var loading = GroupListStore.hasStatus(group.id, 'assignTo');

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
          <span>LOADING</span>
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
