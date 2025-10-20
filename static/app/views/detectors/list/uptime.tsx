import DetectorsList from 'sentry/views/detectors/list';
import {
  MonitorViewContext,
  useMonitorViewContext,
} from 'sentry/views/detectors/monitorViewContext';

export default function UptimeDetectorsList() {
  const parentContext = useMonitorViewContext();

  return (
    <MonitorViewContext.Provider
      value={{
        ...parentContext,
        detectorFilter: 'uptime_domain_failure',
      }}
    >
      <DetectorsList />
    </MonitorViewContext.Provider>
  );
}
