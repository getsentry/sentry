/*** @jsx React.DOM */

var React = require("react");

var api = require("../api");
var Alerts = require("../components/alerts");
var PropTypes = require("../proptypes");

var App = React.createClass({
  propTypes: {
    isAuthenticated: React.PropTypes.bool.isRequired,
    user: PropTypes.User
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
