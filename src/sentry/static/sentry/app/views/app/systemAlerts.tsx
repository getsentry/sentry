import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {ThemeProvider} from 'emotion-theming';

import AlertStore from 'app/stores/alertStore';
import theme from 'app/utils/theme';

import AlertMessage from './alertMessage';

type Props = {className?: string};
type Alert = React.ComponentProps<typeof AlertMessage>['alert'];
type State = {
  alerts: Array<Alert>;
};

const Alerts = createReactClass<Props, State>({
  displayName: 'Alerts',
  mixins: [Reflux.connect(AlertStore, 'alerts') as any],

  getInitialState() {
    return {
      alerts: [],
    };
  },

  render() {
    const {className} = this.props;
    const alerts = this.state.alerts as Array<Alert>;
    return (
      <ThemeProvider theme={theme}>
        <div className={className}>
          {alerts.map((alert, index) => (
            <AlertMessage alert={alert} key={`${alert.id}-${index}`} system />
          ))}
        </div>
      </ThemeProvider>
    );
  },
});

export default Alerts;
