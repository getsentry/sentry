/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var OrganizationState = require("../mixins/organizationState");
// var OrganizationSidebar = require("../components/organizationSidebar");
var Footer = require("../components/footer");
var RouteMixin = require("../mixins/routeMixin");
var TeamStore = require("../stores/teamStore");

var OrganizationDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    RouteMixin
  ],

  crumbReservations: 1,

  childContextTypes: {
    organization: PropTypes.Organization
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  getChildContext() {
    return {
      organization: this.state.organization
    };
  },

  getInitialState() {
    return {
      loading: false,
      error: false,
      organization: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(nextPath, nextParams) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    if (nextParams.orgId != params.orgId) {
      this.fetchData();
    }
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getOrganizationDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          organization: data,
          loading: false
        });

        TeamStore.loadInitialData(data.teams);

        this.setBreadcrumbs([
          {name: data.name, to: 'organizationDetails'}
        ]);
      }
    });
  },

  getOrganizationDetailsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/';
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }
    return (
      <div>
        <div className="app">
          <Router.RouteHandler />
          <Footer />
        </div>
      </div>
    );
  }
});

module.exports = OrganizationDetails;
