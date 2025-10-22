import DetectorsList from 'sentry/views/detectors/list';
import {
  MonitorViewContext,
  useMonitorViewContext,
} from 'sentry/views/detectors/monitorViewContext';

export default function CronDetectorsList() {
  const parentContext = useMonitorViewContext();

  return (
    <MonitorViewContext.Provider
      value={{
        ...parentContext,
        detectorFilter: 'monitor_check_in_failure',
      }}
    >
      <DetectorsList />
    </MonitorViewContext.Provider>
  );
}
