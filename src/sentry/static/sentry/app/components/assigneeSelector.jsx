/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var api = require("../api");
var AggregateListStore = require("../stores/aggregateListStore");
var DropdownLink = require("./dropdownLink");
var Gravatar = require("./gravatar");
var MenuItem = require("./menuItem");
var PropTypes = require("../proptypes");

var AssigneeSelector = React.createClass({
  mixins: [Reflux.ListenerMixin],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
  },

  getInitialState() {
    return {
      filterQuery: ''
    };
  },

  assignTo(member) {
    api.assignTo({id: this.props.aggregate.id, email: member.email});
    this.setState({filterQuery: ''});
  },

  clearAssignTo() {
    api.assignTo({id: this.props.aggregate.id, email: ''});
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
    var agg = this.props.aggregate;
    var loading = AggregateListStore.hasStatus(agg.id, 'assignTo');

    var className = "assignee-selector anchor-right";
    if (!agg.assignedTo) {
      className += " unassigned";
    }
    var filterQuery = this.state.filterQuery;
    var memberNodes = this.props.memberList.filter((item) => {
      if (item.email.indexOf(filterQuery) !== -1) {
        return true;
      }
      if (item.name && item.name.indexOf(filterQuery) !== -1) {
        return true;
      }
      return false;
    }).map((item) => {
      return (
        <MenuItem key={item.id}
                  disabled={!loading}
                  onSelect={this.assignTo.bind(this, item)} >
          <Gravatar email={item.email} className="avatar"
                    size={16} />
          {item.name || item.email}
        </MenuItem>
      );
    });

    return (
      <div className={className}>
        {loading ?
          <span>LOADING</span>
        :
          <DropdownLink
            className="assignee-selector-toggle"
            onOpen={this.onDropdownOpen}
            onClose={this.onDropdownClose}
            title={agg.assignedTo ?
              <img src={agg.assignedTo.avatarUrl} className="avatar" />
              :
              <span className="icon-user" />
            }>
            <MenuItem noAnchor={true} key="filter">
              <input type="text" className="form-control input-sm"
                     ref="filter" placeholder="Filter people"
                     onChange={this.onChangeFilter} />
            </MenuItem>
            {agg.assignedTo ?
              <MenuItem key="clear"
                        disabled={!loading}
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
