import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import Alerts from '../components/alerts';
import AlertActions from '../actions/alertActions.jsx';
import Indicators from '../components/indicators';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationStore from '../stores/organizationStore';
import ConfigStore from '../stores/configStore';

const App = React.createClass({
  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      loading: false,
      error: false
    };
  },

  componentWillMount() {
    this.api.request('/organizations/', {
      query: {
        'member': '1'
      },
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

    this.api.request('/internal/health/', {
      success: (data) => {
        if (data && data.problems) {
          data.problems.forEach(problem => {
            AlertActions.addAlert(problem, 'error');
          });
        }
      },
      error: () => {} // TODO: do something?
    });

    ConfigStore.get('messages').forEach((msg) => {
      AlertActions.addAlert(msg.message, msg.level);
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
        {this.props.children}
      </div>
    );
  }
});

export default App;
