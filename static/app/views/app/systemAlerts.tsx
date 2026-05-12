import {Container} from '@sentry/scraps/layout';

import {AlertStore} from 'sentry/stores/alertStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {AlertMessage} from './alertMessage';

type Props = {className?: string};

export function SystemAlerts(props: Props) {
  const alerts = useLegacyStore(AlertStore);

  return (
    <Container {...props}>
      {alerts.map((alert, index) => (
        <AlertMessage alert={alert} key={`${alert.id}-${index}`} system />
      ))}
    </Container>
  );
}
