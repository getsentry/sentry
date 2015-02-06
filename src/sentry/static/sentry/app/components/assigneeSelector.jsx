/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var api = require("../api");
var AggregateListStore = require("../stores/aggregateListStore");
var DropdownLink = require("./dropdownLink");
var MenuItem = require("./menuItem");
var PropTypes = require("../proptypes");

var AssigneeSelector = React.createClass({
  mixins: [Reflux.ListenerMixin],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
  },

  assignTo: function(member) {
    api.assignTo({id: this.props.aggregate.id, email: member.email});
  },

  clearAssignTo: function() {
    api.assignTo({id: this.props.aggregate.id, email: ''});
  },

  render: function() {
    var agg = this.props.aggregate;

    var loading = AggregateListStore.hasStatus(agg.id, 'assignTo');

    var className = "assignee-selector anchor-right";
    if (!agg.assignedTo) {
      className += " unassigned";
    }

    var memberNodes = [];
    this.props.memberList.forEach(function(item){
      memberNodes.push(
        <MenuItem key={item.id}
                  disabled={!loading}
                  onSelect={this.assignTo.bind(this, item)} >
          <img src={item.avatarUrl} className="avatar" />
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
            title={agg.assignedTo ?
              <img src={agg.assignedTo.avatarUrl} className="avatar" />
              :
              <span className="icon-user" />
            }>
            <MenuItem noAnchor={true} key="filter">
              <input type="text" className="form-control input-sm" placeholder="Filter people" />
            </MenuItem>
            {agg.assignedTo ?
              <MenuItem className="clear-assignee" key="clear"
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
