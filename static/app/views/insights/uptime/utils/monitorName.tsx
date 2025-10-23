import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';

/**
 * Returns the monitor name, falling back to a generated name from the URL if empty.
 * Auto-detected monitors may not have names set in the database.
 *
 * HOTFIX: monitor_names_missing_default
 * Auto-detected monitors were created without names. This function provides a fallback
 * until we backfill names for all existing monitors.
 */
export function monitorName(detector: UptimeDetector): string {
  if (detector.name) {
    return detector.name;
  }

  // Generate a default name from the URL for monitors without names
  const url = detector.dataSources[0]?.queryObj.url;
  return url ? `Uptime Monitoring for ${url}` : 'Unnamed Monitor';
}
