import {useLocation} from 'sentry/utils/useLocation';
import ConnectedMonitorsList, {
  MONITORS_PER_PAGE,
} from 'sentry/views/automations/components/connectedMonitorsList';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

export function AutomationConnectedMonitors({detectorIds}: {detectorIds: string[]}) {
  const location = useLocation();

  // Fetch connected monitors
  const connectedDetectorsQueryResults = useDetectorsQuery(
    {
      ids: detectorIds,
      limit: MONITORS_PER_PAGE,
      cursor:
        typeof location.query.cursor === 'string' ? location.query.cursor : undefined,
    },
    {enabled: false}
  );

  return (
    <ConnectedMonitorsList
      detectorCount={detectorIds.length}
      detectorQueryResults={connectedDetectorsQueryResults}
    />
  );
}
