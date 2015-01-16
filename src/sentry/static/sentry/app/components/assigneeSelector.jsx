/*** @jsx React.DOM */

var React = require("react");

var AggregateListActions = require("../actions/aggregateListActions");
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
    this.setState({loading: true});
    AggregateListActions.setAssignedTo(this.props.aggregate.id, member.email, this.onAssignToComplete);
  },

  onAssignToComplete: function() {
    this.setState({loading: false});
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
                  disabled={!this.state.loading}
                  onSelect={this.onAssignTo.bind(this, item)} >
          <img src={item.avatarUrl} className="avatar" />
          {item.name || item.email}
        </MenuItem>
      );
    }.bind(this));

    return (
      <div className={className}>
        {this.state.loading ?
          <span>LOADING</span>
        :
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
        }
      </div>
    );
  }
});

module.exports = AssigneeSelector;
