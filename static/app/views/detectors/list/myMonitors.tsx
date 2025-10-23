import DetectorsList from 'sentry/views/detectors/list';
import {
  MonitorViewContext,
  useMonitorViewContext,
} from 'sentry/views/detectors/monitorViewContext';

export default function MyMonitorsList() {
  const parentContext = useMonitorViewContext();

  return (
    <MonitorViewContext.Provider
      value={{
        ...parentContext,
        assigneeFilter: '[me,my_teams]',
      }}
    >
      <DetectorsList />
    </MonitorViewContext.Provider>
  );
}
