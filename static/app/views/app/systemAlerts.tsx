import AlertStore from 'app/stores/alertStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';

import AlertMessage from './alertMessage';

type Props = {className?: string};

function SystemAlerts(props: Props) {
  const alerts = useLegacyStore(AlertStore);

  return (
    <div {...props}>
      {alerts.map((alert, index) => (
        <AlertMessage alert={alert} key={`${alert.id}-${index}`} system />
      ))}
    </div>
  );
}

export default SystemAlerts;
