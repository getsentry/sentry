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
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    BreadcrumbMixin,
    Reflux.listenTo(GroupListStore, "onAggListChange")
  ],

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    setProjectNavSection: React.PropTypes.func.isRequired
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
      group: null
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');

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
    var id = this.context.router.getCurrentParams().groupId;

    this.setState({
      group: GroupListStore.getItem(id)
    });
  },

  getGroupDetailsEndpoint() {
    var id = this.context.router.getCurrentParams().groupId;

    return '/groups/' + id + '/';
  },

  render() {
    var group = this.state.group;
    var params = this.context.router.getCurrentParams();

    if (!group) {
      return <div />;
    }

    return (
      <div className={this.props.className}>
        <GroupHeader
            orgId={params.orgId}
            projectId={params.projectId}
            group={group}
            memberList={this.props.memberList} />
        <Router.RouteHandler
            memberList={this.props.memberList}
            group={group} />
      </div>
    );
  }
});

module.exports = GroupDetails;
