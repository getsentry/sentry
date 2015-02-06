/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var TeamState = require("../mixins/teamState");

var TeamDashboard = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Router.State
  ],

  getInitialState() {
    return {
      team: null
    };
  },

  childContextTypes: {
    team: PropTypes.Team
  },

  getChildContext() {
     return {team: this.state.team};
  },

  componentWillMount() {
    api.request(this.getTeamDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          team: data
        });

        this.setBreadcrumbs([
          {name: data.name, to: 'teamDetails'}
        ]);
      }
    });
  },

  getTeamDetailsEndpoint() {
    var params = this.getParams();
    return '/teams/' + params.orgId + '/' + params.teamId + '/';
  },

  render() {
    if (!this.state.team) {
      return <LoadingIndicator />;
    }
    return <Router.RouteHandler />;
  }
});

module.exports = TeamDashboard;
