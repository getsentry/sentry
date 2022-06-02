import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';

import MonitorHeaderActions from './monitorHeaderActions';
import MonitorIcon from './monitorIcon';

type Props = React.ComponentProps<typeof MonitorHeaderActions>;

const MonitorHeader = ({monitor, orgId, onUpdate}: Props) => (
  <div className="release-details">
    <div className="row">
      <div className="col-sm-6 col-xs-10">
        <h3>{monitor.name}</h3>
        <div className="release-meta">{monitor.id}</div>
      </div>
      <div className="col-sm-2 hidden-xs">
        <h6 className="nav-header">{t('Last Check-in')}</h6>
        {monitor.lastCheckIn && <TimeSince date={monitor.lastCheckIn} />}
      </div>
      <div className="col-sm-2 hidden-xs">
        <h6 className="nav-header">{t('Next Check-in')}</h6>
        {monitor.nextCheckIn && <TimeSince date={monitor.nextCheckIn} />}
      </div>
      <div className="col-sm-2">
        <h6 className="nav-header">{t('Status')}</h6>
        <MonitorIcon status={monitor.status} size={16} />
      </div>
    </div>
    <MonitorHeaderActions orgId={orgId} monitor={monitor} onUpdate={onUpdate} />
  </div>
);

export default MonitorHeader;
