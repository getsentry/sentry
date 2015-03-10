/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var OrganizationHeader = require("../components/organizationHeader");
var OrganizationState = require("../mixins/organizationState");
var OrganizationSidebar = require("../components/organizationSidebar");
var OrganizationFooter = require("../components/organizationFooter");
var RouteMixin = require("../mixins/routeMixin");

var OrganizationDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    RouteMixin,
    Router.State
  ],

  crumbReservations: 1,

  childContextTypes: {
    organization: PropTypes.Organization
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
    if (nextParams.orgId != this.getParams().orgId) {
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

        this.setBreadcrumbs([
          {name: data.name, to: 'organizationDetails'}
        ]);
      }
    });
  },

  getOrganizationDetailsEndpoint() {
    var params = this.getParams();
    return '/organizations/' + params.orgId + '/';
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }
    return (
      <div>
        <OrganizationSidebar />
        <div className="app">
          <OrganizationHeader />
          <div className="container">
            <div className="content">
              <Router.RouteHandler />
            </div>
          </div>
          <OrganizationFooter />
        </div>
      </div>
    );
  }
});

module.exports = OrganizationDetails;
