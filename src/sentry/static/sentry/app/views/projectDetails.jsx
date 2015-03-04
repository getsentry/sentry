/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var MemberListStore = require("../stores/memberListStore");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationState = require("../mixins/organizationState");
var RouteMixin = require("../mixins/routeMixin");
var PropTypes = require("../proptypes");

var ProjectDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Reflux.connect(MemberListStore, "memberList"),
    OrganizationState,
    RouteMixin,
    Router.State
  ],

  getInitialState() {
    return {
      memberList: [],
      project: null,
      team: null
    };
  },

  childContextTypes: {
    organization: PropTypes.Organization,
    project: PropTypes.Project,
    team: PropTypes.Team
  },

  getChildContext() {
    return {
      organization: this.getOrganization(),
      project: this.state.project,
      team: this.state.team
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(nextProps) {
    this.fetchData();
  },

  fetchData() {
    // TODO(dcramer): we could read some of this info from contexts
    api.request(this.getMemberListEndpoint(), {
      success: (data) => {
        MemberListStore.loadInitialData(data);
      }
    });

    api.request(this.getProjectDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          project: data,
          team: data.team
        });

        this.setBreadcrumbs([
          {name: data.team.name, to: 'teamDetails', params: {
            orgId: this.getParams().orgId,
            teamId: data.team.slug
          }},
          {name: data.name, to: 'projectDetails'}
        ]);
      }
    });
  },

  getProjectDetailsEndpoint() {
    var params = this.getParams();
    return '/projects/' + params.orgId + '/' + params.projectId + '/';
  },

  getMemberListEndpoint() {
    var params = this.getParams();
    return '/projects/' + params.orgId + '/' + params.projectId + '/members/';
  },

  render() {
    if (!this.state.project) {
      return <LoadingIndicator />;
    }
    return (
      <Router.RouteHandler
          memberList={this.state.memberList} />
    );
  }
});

module.exports = ProjectDetails;
