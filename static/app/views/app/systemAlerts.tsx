import {Container} from '@sentry/scraps/layout';

import {AlertMessage} from './alertMessage';
import {useGlobalAlerts} from './globalAlerts';

type Props = {className?: string};

export function SystemAlerts(props: Props) {
  const {alerts, closeAlert} = useGlobalAlerts();

  return (
    <Container {...props}>
      {alerts.map(alert => (
        <AlertMessage
          alert={alert}
          key={alert.key}
          onClose={() => closeAlert(alert)}
          system
        />
      ))}
    </Container>
  );
}
