import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {ThemeProvider} from 'emotion-theming';

import AlertStore from 'app/stores/alertStore';
import AlertMessage from 'app/components/alertMessage';
import theme from 'app/utils/theme';

type Alert = React.ComponentProps<typeof AlertMessage>['alert'];

type State = {
  alerts: Array<Alert>;
};

const Alerts = createReactClass<{}, State>({
  displayName: 'Alerts',
  mixins: [Reflux.connect(AlertStore, 'alerts') as any],

  getInitialState() {
    return {
      alerts: [],
    };
  },

  render() {
    const alerts = this.state.alerts as Array<Alert>;
    return (
      <ThemeProvider theme={theme}>
        <div {...this.props}>
          {alerts.map(alert => (
            <AlertMessage alert={alert} key={alert.id} system />
          ))}
        </div>
      </ThemeProvider>
    );
  },
});

export default Alerts;
