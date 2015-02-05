/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var MemberListStore = require("../stores/memberListStore");
var ProjectState = require("../mixins/projectState");
var PropTypes = require("../proptypes");

var ProjectDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Reflux.connect(MemberListStore, "memberList"),
    Router.State,
    ProjectState
  ],

  getInitialState() {
    return {
      memberList: [],
      project: null,
      team: null
    };
  },

  childContextTypes: {
    project: PropTypes.Project,
    team: PropTypes.Team
  },

  getChildContext() {
    return {
      project: this.state.project,
      team: this.state.team
    };
  },

  componentWillMount() {
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
          {name: data.team.name, to: 'teamDashboard'},
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
      return <div className="loading">PUT ROBOT HERE PLZ KTHX</div>;
    }
    return (
      <Router.RouteHandler
          memberList={this.state.memberList} />
    );
  }
});

module.exports = ProjectDetails;
