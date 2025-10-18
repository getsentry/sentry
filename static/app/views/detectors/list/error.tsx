import DetectorsList from 'sentry/views/detectors/list';
import {
  MonitorViewContext,
  useMonitorViewContext,
} from 'sentry/views/detectors/monitorViewContext';

export default function ErrorDetectorsList() {
  const parentContext = useMonitorViewContext();

  return (
    <MonitorViewContext.Provider
      value={{
        ...parentContext,
        detectorFilter: 'error',
      }}
    >
      <DetectorsList />
    </MonitorViewContext.Provider>
  );
}
