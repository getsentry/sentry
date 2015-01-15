/*** @jsx React.DOM */

var React = require("react");

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
        <li>
          <a onClick={this.onAssignTo.bind(this, item)}>
            <img src={item.avatarUrl} className="avatar" />
            {item.name || item.email}
          </a>
        </li>
      );
    });

    return (
      <div className={className}>
        <div className="dropdown">
          <a href="#" className="btn btn-sm btn-default" dropdown-toggle>
            {agg.assignedTo ?
              <img src={agg.assignedTo.avatarUrl} className="avatar" />
            :
              <span className="icon-user" />
            }
            <span aria-hidden="true" className="icon-arrow-down"></span>
          </a>
          <div className="dropdown-menu" role="menu">
            <input type="text" className="form-control input-sm" placeholder="Filter people" />
            <ul>
              {memberNodes}
            </ul>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = AssigneeSelector;
