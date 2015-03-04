/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var OrganizationState = require("../mixins/organizationState");

var OrganizationDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Router.State
  ],

  getInitialState() {
    return {
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
    api.request(this.getOrganizationDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          organization: data
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
    if (!this.state.organization) {
      return <LoadingIndicator />;
    }
    return <Router.RouteHandler />;
  }
});

module.exports = OrganizationDetails;
