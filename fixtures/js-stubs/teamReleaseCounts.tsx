import {ProjectReleaseCount} from 'sentry/views/organizationStats/teamInsights/teamReleases';

export function TeamReleaseCounts(): ProjectReleaseCount {
  return {
    release_counts: {
      '2021-03-11': 1,
      '2021-03-12': 2,
      '2021-03-13': 1,
      '2021-03-14': 0,
      '2021-03-15': 0,
      '2021-03-16': 0,
      '2021-03-17': 0,
      '2021-03-18': 0,
      '2021-03-19': 0,
      '2021-03-20': 1,
      '2021-03-21': 0,
      '2021-03-22': 1,
      '2021-03-23': 0,
      '2021-03-24': 0,
    },
    project_avgs: {
      123: 3,
      234: 4,
    },
    last_week_totals: {
      123: 2,
      234: 4,
    },
  };
}
