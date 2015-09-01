import React from "react";
import api from "../api";
import Router from "react-router";
import Alerts from "../components/alerts";
import AlertActions from "../actions/alertActions.jsx";
import Indicators from "../components/indicators";
import LoadingIndicator from "../components/loadingIndicator";
import OrganizationStore from "../stores/organizationStore";

var App = React.createClass({
  getInitialState() {
    return {
      loading: false,
      error: false
    };
  },

  componentWillMount() {
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

    api.request('/internal/health/', {
      success: (data) => {
        if (data && data.problems) {
          data.problems.forEach(problem => {
            AlertActions.addAlert(problem, 'error');
          });
        }
      },
      error: () => {} // TODO: do something?
    });

  },

  componentWillUnmount() {
    OrganizationStore.load([]);
  },

  render() {
    if (this.state.loading) {
      return (
        <LoadingIndicator triangle={true}>
          Getting a list of all of your organizations.
        </LoadingIndicator>
      );
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
