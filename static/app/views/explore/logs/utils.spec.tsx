import {OrganizationFixture} from 'sentry-fixture/organization';

import {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {getLogsUrlFromSavedQueryUrl} from 'sentry/views/explore/logs/utils';
import {Mode} from 'sentry/views/explore/queryParams/mode';

describe('getLogsUrlFromSavedQueryUrl', () => {
  const organization = OrganizationFixture();

  it('uses aggregate fn, aggregate param, and group by', () => {
    const target = getLogsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'foobar',
        projects: [],
        dataset: 'logs',
        dateAdded: '2025-05-06T00:00:00.000000Z',
        dateUpdated: '2025-05-06T00:00:00.000000Z',
        lastVisited: '2025-05-15T00:00:00.000000Z',
        starred: true,
        position: 7,
        isPrebuilt: true,
        query: [
          {
            mode: Mode.SAMPLES,
            query: 'message:foo',
            fields: ['timestamp', 'severity', 'message'],
            orderby: '-timestamp',
            groupby: ['severity'],
            visualize: [
              {
                yAxes: ['count(message)'],
              },
              {
                yAxes: ['p75(foo)', 'p90(foo)'],
                chartType: 1,
              },
            ],
          },
        ],
      }),
    });
    expect(target).toBe(
      '/organizations/org-slug/explore/logs/?aggregateField=%7B%22groupBy%22%3A%22severity%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22count%28message%29%22%5D%7D&aggregateField=%7B%22yAxes%22%3A%5B%22p75%28foo%29%22%2C%22p90%28foo%29%22%5D%2C%22chartType%22%3A1%7D&id=1&interval=5m&logsFields=timestamp&logsFields=severity&logsFields=message&logsQuery=message%3Afoo&logsSortBys=-timestamp&mode=samples&project=&title=foobar'
    );
  });

  it('uses aggregate fields', () => {
    const target = getLogsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'foobar',
        projects: [],
        dataset: 'logs',
        dateAdded: '2025-05-06T00:00:00.000000Z',
        dateUpdated: '2025-05-06T00:00:00.000000Z',
        lastVisited: '2025-05-15T00:00:00.000000Z',
        starred: true,
        position: 7,
        isPrebuilt: true,
        query: [
          {
            mode: Mode.SAMPLES,
            query: 'message:foo',
            fields: ['timestamp', 'severity', 'message'],
            orderby: '-timestamp',
            aggregateField: [
              {groupBy: 'severity'},
              {
                yAxes: ['count(message)'],
              },
              {
                yAxes: ['p75(foo)', 'p90(foo)'],
                chartType: 1,
              },
            ],
          },
        ],
      }),
    });
    expect(target).toBe(
      '/organizations/org-slug/explore/logs/?aggregateField=%7B%22groupBy%22%3A%22severity%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22count%28message%29%22%5D%7D&aggregateField=%7B%22yAxes%22%3A%5B%22p75%28foo%29%22%2C%22p90%28foo%29%22%5D%2C%22chartType%22%3A1%7D&id=1&interval=5m&logsFields=timestamp&logsFields=severity&logsFields=message&logsQuery=message%3Afoo&logsSortBys=-timestamp&mode=samples&project=&title=foobar'
    );
  });
});
