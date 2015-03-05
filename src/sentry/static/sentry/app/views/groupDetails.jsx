/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var GroupHeader = require("./groupDetails/header");
var GroupListStore = require("../stores/groupStore");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var PropTypes = require("../proptypes");
var utils = require("../utils");

var GroupDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Reflux.listenTo(GroupListStore, "onAggListChange"),
    Router.State
  ],

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  crumbReservations: 1,

  childContextTypes: {
    group: PropTypes.Group,
  },

  getChildContext() {
    return {
      group: this.state.group,
    };
  },

  getInitialState() {
    return {
      group: null,
      statsPeriod: '48h'
    };
  },

  componentWillMount() {
    api.request(this.getGroupDetailsEndpoint(), {
      success: (data) => {
        GroupListStore.loadInitialData([data]);

        this.setBreadcrumbs([
          {name: data.title, to: 'groupDetails'}
        ]);
      }
    });
  },

  onAggListChange() {
    var id = this.getParams().groupId;

    this.setState({
      group: GroupListStore.getItem(id)
    });
  },

  getGroupDetailsEndpoint() {
    return '/groups/' + this.getParams().groupId + '/';
  },

  render() {
    var group = this.state.group;
    var params = this.getParams();

    if (!group) {
      return <div />;
    }

    return (
      <div className={this.props.className}>
        <GroupHeader
            orgId={params.orgId}
            projectId={params.projectId}
            group={group}
            statsPeriod={this.state.statsPeriod}
            memberList={this.props.memberList} />
        <Router.RouteHandler
            memberList={this.props.memberList}
            group={group}
            statsPeriod={this.state.statsPeriod} />
      </div>
    );
  }
});

module.exports = GroupDetails;
