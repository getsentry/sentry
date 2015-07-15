var React = require("react");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var DocumentTitle = require("react-document-title");
var Footer = require("../components/footer");
var Header = require("../components/header");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationState = require("../mixins/organizationState");
var PropTypes = require("../proptypes");
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
      loading: true,
      error: false,
      organization: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillUnmount() {
    TeamStore.reset();
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
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  getOrganizationDetailsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/';
  },

  getTitle() {
    if (this.state.organization)
      return this.state.organization.name + ' | Sentry';
    return 'Sentry';
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <Header />
          <Router.RouteHandler />
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
});

module.exports = OrganizationDetails;
