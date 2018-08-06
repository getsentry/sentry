import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {ThemeProvider} from 'emotion-theming';

import AlertStore from 'app/stores/alertStore';
import AlertMessage from 'app/components/alertMessage';

import theme from 'app/utils/theme';

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
