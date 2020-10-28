import {initializeOrg} from 'sentry-test/initializeOrg';

import {Dataset} from 'app/views/settings/incidentRules/types';
import {getIncidentDiscoverUrl} from 'app/views/alerts/utils';

describe('Alert utils', function () {
  const {org, projects} = initializeOrg();

  const mockStats = {
    eventStats: {
      data: [
        [0, 10],
        [120, 10],
      ],
    },
  };

  describe('getIncidentDiscoverUrl', function () {
    it('creates a discover query url for errors', function () {
      const incident = {
        title: 'Test error alert',
        discoverQuery: 'id:test',
        projects,
        alertRule: {
          timeWindow: 1,
          dataset: Dataset.ERRORS,
          aggregate: 'count()',
        },
      };

      const to = getIncidentDiscoverUrl({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
      });

      expect(to).toEqual({
        query: expect.objectContaining({
          name: 'Test error alert',
          field: ['issue', 'count()', 'count_unique(user)'],
          sort: ['-count'],
          query: 'id:test',
          yAxis: 'count()',
          start: '1970-01-01T00:00:00.000',
          end: '1970-01-01T00:02:00.000',
          interval: '1m',
        }),
        pathname: '/organizations/org-slug/discover/results/',
      });
    });

    it('creates a discover query url for transactions', function () {
      const incident = {
        title: 'Test transaction alert',
        discoverQuery: 'id:test',
        projects,
        alertRule: {
          timeWindow: 1,
          dataset: Dataset.TRANSACTIONS,
          aggregate: 'p90()',
        },
      };

      const to = getIncidentDiscoverUrl({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
      });

      expect(to).toEqual({
        query: expect.objectContaining({
          name: 'Test transaction alert',
          field: ['transaction', 'p90()'],
          sort: ['-p90'],
          query: 'id:test',
          yAxis: 'p90()',
        }),
        pathname: '/organizations/org-slug/discover/results/',
      });
    });
  });
});
