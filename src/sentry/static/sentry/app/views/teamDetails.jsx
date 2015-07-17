var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationHeader = require("../components/organizationHeader");
var OrganizationState = require("../mixins/organizationState");
var PropTypes = require("../proptypes");
var RouteMixin = require("../mixins/routeMixin");

var TeamDetails = React.createClass({
  mixins: [
    OrganizationState,
    RouteMixin
  ],

  childContextTypes: {
    team: PropTypes.Team
  },

  contextTypes: {
    router: React.PropTypes.func
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
    var router = this.context.router;
    var params = router.getCurrentParams();
    if (nextParams.teamId != params.teamId) {
      this.fetchData();
    }
  },

  fetchData() {
    var org = this.getOrganization();
    if (!org) {
      return;
    }

    var router = this.context.router;
    var params = router.getCurrentParams();
    var teamSlug = params.teamId;
    var team = org.teams.filter((team) => {
      return team.slug === teamSlug;
    })[0];

    this.setState({
      team: team,
      loading: false,
      error: typeof team !== "undefined"
    });
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
