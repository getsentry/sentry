/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationState = require("../mixins/organizationState");
var PropTypes = require("../proptypes");
var RouteMixin = require("../mixins/routeMixin");

var TeamDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    OrganizationState,
    RouteMixin,
    Router.State
  ],

  crumbReservations: 1,

  childContextTypes: {
    organization: PropTypes.Organization,
    team: PropTypes.Team
  },

  getChildContext() {
    return {
      organization: this.getOrganization(),
      team: this.state.team
    };
  },

  getInitialState() {
    return {
      team: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(nextPath, nextParams) {
    if (nextParams.teamId != this.getParams().teamId) {
      this.fetchData();
    }
  },

  fetchData() {
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

module.exports = TeamDetails;
