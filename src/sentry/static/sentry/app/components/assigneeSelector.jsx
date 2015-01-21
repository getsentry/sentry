/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var AggregateListActions = require("../actions/aggregateListActions");
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");

var AssigneeSelector = React.createClass({
  mixins: [Reflux.ListenerMixin],

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

  componentDidMount: function() {
    this.listenTo(AggregateListActions.assignTo, this.onAssignTo);
    this.listenTo(AggregateListActions.assignTo.completed, this.onAssignToCompleted);
    this.listenTo(AggregateListActions.assignTo.failed, this.onAssignToCompleted);
  },

  onAssignTo: function(id) {
    if (id !== this.props.aggregate.id) {
      return;
    }
    this.setState({loading: true});
  },

  onAssignToCompleted: function(id) {
    if (id !== this.props.aggregate.id) {
      return;
    }
    this.setState({loading: false});
  },

  assignTo: function(member) {
    AggregateListActions.assignTo(this.props.aggregate.id, member.email);
  },

  clearAssignTo: function(member) {
    AggregateListActions.assignTo(this.props.aggregate.id, '');
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
                  onSelect={this.assignTo.bind(this, item)} >
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
            {agg.assignedTo ?
              <MenuItem key="clear"
                        disabled={!this.state.loading}
                        onSelect={this.clearAssignTo}>
                Clear Assignee
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
