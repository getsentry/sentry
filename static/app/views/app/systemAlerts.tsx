import * as React from 'react';
import {ThemeProvider} from '@emotion/react';

import AlertStore from 'app/stores/alertStore';
import {lightTheme} from 'app/utils/theme';

import AlertMessage from './alertMessage';

type Props = {className?: string};
type Alert = React.ComponentProps<typeof AlertMessage>['alert'];
type State = {
  alerts: Array<Alert>;
};

class SystemAlerts extends React.Component<Props, State> {
  state = this.getInitialState();

  getInitialState(): State {
    return {
      alerts: AlertStore.getInitialState() as Alert[],
    };
  }

  componentWillUnmount() {
    this.unlistener?.();
  }

  unlistener = AlertStore.listen((alerts: Alert[]) => this.setState({alerts}), undefined);

  render() {
    const {className} = this.props;
    const {alerts} = this.state;
    return (
      <ThemeProvider theme={lightTheme}>
        <div className={className}>
          {alerts.map((alert, index) => (
            <AlertMessage alert={alert} key={`${alert.id}-${index}`} system />
          ))}
        </div>
      </ThemeProvider>
    );
  }
}

export default SystemAlerts;
