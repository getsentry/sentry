/*** @jsx React.DOM */

var React = require("react");

var api = require("../api");
var Alerts = require("../components/alerts");
var ConfigStore = require("../stores/configStore");
var PropTypes = require("../proptypes");

var App = React.createClass({
  propTypes: {
    config: React.PropTypes.object.isRequired
  },

  childContextTypes: {
    organizationList: React.PropTypes.arrayOf(PropTypes.Organization).isRequired,
  },

  getChildContext() {
    return {
      organizationList: this.state.organizationList
    };
  },

  getInitialState() {
    return {
      loading: false,
      error: false,
      organizationList: []
    };
  },

  componentWillMount() {
    ConfigStore.loadInitialData(this.props.config);

    api.request('/organizations/', {
      success: (data) => {
        this.setState({
          loading: false,
          organizationList: data
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

  render() {
    return (
      <div>
        <Alerts className="messages-container affix" />
        <Router.RouteHandler />
      </div>
    );
  }
});

module.exports = App;
