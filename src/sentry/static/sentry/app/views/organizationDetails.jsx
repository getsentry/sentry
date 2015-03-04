/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var OrganizationHeader = require("../components/organizationHeader");
var OrganizationState = require("../mixins/organizationState");
var OrganizationSidebar = require("../components/organizationSidebar");
var RouteMixin = require("../mixins/routeMixin");

var OrganizationDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Router.State
  ],

  getInitialState() {
    return {
      loading: false,
      error: false,
      organization: null
    };
  },

  childContextTypes: {
    organization: PropTypes.Organization
  },

  getChildContext() {
    return {
      organization: this.state.organization
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    this.fetchData();
  },

  fetchData() {
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
        </div>
      </div>
    );
  }
});

module.exports = OrganizationDetails;
