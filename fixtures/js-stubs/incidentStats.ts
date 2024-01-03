import {IncidentStats} from 'sentry/views/alerts/types';

export function IncidentStatsFixture(params: Partial<IncidentStats> = {}): IncidentStats {
  return {
    totalEvents: 100,
    uniqueUsers: 20,
    eventStats: {
      data: [],
    },
    ...params,
  };
}
