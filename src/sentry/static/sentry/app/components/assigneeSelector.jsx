/*** @jsx React.DOM */

var React = require("react");

var aggregateListActions = require("../actions/aggregateListActions");
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");

var AssigneeSelector = React.createClass({
  propTypes: {
    aggregate: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
  },

  getInitialState: function() {
    return {
      loading: false
    };
  },

  onAssignTo: function(member) {
    aggregateListActions.setAssignedTo(this.props.aggregate.id, member.email);
  },

  render: function() {
    var agg = this.props.aggregate;

    var className = "user-selector";
    if (!agg.assignedTo) {
      className += " unassigned";
    }

    var memberNodes = [];
    this.props.memberList.forEach(function(item){
      memberNodes.push(
        <MenuItem key={item.id}
                  onSelect={this.onAssignTo.bind(this, item)} >
          <img src={item.avatarUrl} className="avatar" />
          {item.name || item.email}
        </MenuItem>
      );
    }.bind(this));

    return (
      <div className={className}>
        <DropdownLink
          className="btn-sm btn-default"
          title={agg.assignedTo ?
            <img src={agg.assignedTo.avatarUrl} className="avatar" />
          :
            <span className="icon-user" />
          }>
          <MenuItem noAnchor={true} key="filter">
            <input type="text" className="form-control input-sm" placeholder="Filter people" />
          </MenuItem>
          {memberNodes}
        </DropdownLink>
      </div>
    );
  }
});

module.exports = AssigneeSelector;
