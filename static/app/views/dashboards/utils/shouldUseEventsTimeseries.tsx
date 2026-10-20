import type {Organization} from 'sentry/types/organization';

// Whether dashboard widgets fetch series from `/events-timeseries/` instead of `/events-stats/`
export function shouldUseEventsTimeseries(organization: Organization) {
  return organization.features.includes('dashboards-widgets-use-events-timeseries');
}
