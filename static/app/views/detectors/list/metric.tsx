import DetectorsList from 'sentry/views/detectors/list';
import {
  MonitorViewContext,
  useMonitorViewContext,
} from 'sentry/views/detectors/monitorViewContext';

export default function MetricDetectorsList() {
  const parentContext = useMonitorViewContext();

  return (
    <MonitorViewContext.Provider
      value={{
        ...parentContext,
        detectorFilter: 'metric_issue',
      }}
    >
      <DetectorsList />
    </MonitorViewContext.Provider>
  );
}
