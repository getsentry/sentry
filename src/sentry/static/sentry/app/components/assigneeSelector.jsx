/*** @jsx React.DOM */

var React = require("react");

var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");

var AssigneeSelector = React.createClass({
  propTypes: {
    aggregate: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    onAssignTo: React.PropTypes.func.isRequired
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
                  onSelect={this.props.onAssignTo.bind(this, item)} >
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
