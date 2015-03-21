/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationHeader = require("../components/organizationHeader");
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
    team: PropTypes.Team
  },

  getChildContext() {
    return {
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
    var org = this.getOrganization();
    if (!org) {
      return;
    }

    var teamSlug = this.getParams().teamId;
    var team = org.teams.filter((team) => {
      return team.slug === teamSlug;
    })[0];

    this.setState({
      team: team,
      loading: false,
      error: typeof team !== "undefined"
    });
    if (typeof team !== "undefined") {
      this.setBreadcrumbs([
        {name: team.name, to: "teamDetails"}
      ]);
    }
  },

  render() {
    if (!this.state.team) {
      return <LoadingIndicator />;
    }

    return (
      <div>
        <OrganizationHeader />
        <div className="container">
          <div className="content">
            <Router.RouteHandler />
          </div>
        </div>
      </div>
    );
  }
});

module.exports = TeamDetails;
