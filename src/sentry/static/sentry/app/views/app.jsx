import React from "react";
import api from "../api";
import Alerts from "../components/alerts";
import ConfigStore from "../stores/configStore";
import Header from "../components/header";
import Indicators from "../components/indicators";
import LoadingIndicator from "../components/loadingIndicator";
import OrganizationStore from "../stores/organizationStore";
import PropTypes from "../proptypes";

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

export default App;

