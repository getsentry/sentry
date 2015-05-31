/*** @jsx React.DOM */

var React = require("react");

var api = require("../api");
var Alerts = require("../components/alerts");
var ConfigStore = require("../stores/configStore");
var Header = require("../components/header");
var Indicators = require("../components/indicators");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationStore = require("../stores/organizationStore");
var PropTypes = require("../proptypes");

var App = React.createClass({
  propTypes: {
    config: React.PropTypes.object.isRequired
  },

  getInitialState() {
    return {
      loading: false,
      error: false
    };
  },

  componentWillMount() {
    ConfigStore.loadInitialData(this.props.config);

    api.request('/organizations/', {
      success: (data) => {
        OrganizationStore.load(data);
        this.setState({
          loading: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  componentWillUnmount() {
    OrganizationStore.load([]);
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }

    return (
      <div>
        <Alerts className="messages-container" />
        <Indicators className="indicators-container" />
        <Router.RouteHandler />
      </div>
    );
  }
});

module.exports = App;
