import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {ThemeProvider} from 'emotion-theming';

import AlertStore from '../stores/alertStore';
import AlertMessage from './alertMessage';

import theme from '../utils/theme';

const Alerts = createReactClass({
  displayName: 'Alerts',
  mixins: [Reflux.connect(AlertStore, 'alerts')],

  getInitialState() {
    return {
      alerts: [],
    };
  },

  render() {
    return (
      <ThemeProvider theme={theme}>
        <div {...this.props}>
          {this.state.alerts.map(function(alert) {
            return <AlertMessage alert={alert} key={alert.key} system />;
          })}
        </div>
      </ThemeProvider>
    );
  },
});

export default Alerts;
