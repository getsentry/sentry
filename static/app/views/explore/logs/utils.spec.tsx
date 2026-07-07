import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {Sort} from 'sentry/utils/discover/fields';
import {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  compareLogRowsBySortBys,
  getLogsUrlFromSavedQueryUrl,
  type LogTableRowItem,
} from 'sentry/views/explore/logs/utils';
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

describe('compareLogRowsBySortBys', () => {
  function logRow(
    id: string,
    fields: Partial<OurLogsResponseItem> = {}
  ): LogTableRowItem {
    return LogFixture({
      [OurLogKnownFieldKey.ID]: id,
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
      ...fields,
    });
  }

  function sortedIds(rows: LogTableRowItem[], sortBys: Sort[]): string[] {
    return [...rows]
      .sort((a, b) => compareLogRowsBySortBys(a, b, sortBys))
      .map(row => row[OurLogKnownFieldKey.ID]);
  }

  const older = logRow('older', {[OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1_000});
  const newer = logRow('newer', {[OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 2_000});

  it('orders newest first when sorted by timestamp descending', () => {
    const result = sortedIds(
      [older, newer],
      [{field: OurLogKnownFieldKey.TIMESTAMP, kind: 'desc'}]
    );

    expect(result).toEqual(['newer', 'older']);
  });

  it('orders oldest first when sorted by timestamp ascending', () => {
    const result = sortedIds(
      [newer, older],
      [{field: OurLogKnownFieldKey.TIMESTAMP, kind: 'asc'}]
    );

    expect(result).toEqual(['older', 'newer']);
  });

  it('uses the precise timestamp when sorting by the timestamp_precise field', () => {
    const result = sortedIds(
      [older, newer],
      [{field: OurLogKnownFieldKey.TIMESTAMP_PRECISE, kind: 'desc'}]
    );

    expect(result).toEqual(['newer', 'older']);
  });

  it('orders sub-microsecond nanosecond timestamps that collide as floats', () => {
    const earlier = logRow('earlier', {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1751852800123456700',
    });
    const later = logRow('later', {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1751852800123456789',
    });

    const result = sortedIds(
      [earlier, later],
      [{field: OurLogKnownFieldKey.TIMESTAMP_PRECISE, kind: 'desc'}]
    );

    expect(result).toEqual(['later', 'earlier']);
  });

  it('orders by a non-timestamp string field ascending', () => {
    const error = logRow('error', {[OurLogKnownFieldKey.SEVERITY]: 'error'});
    const info = logRow('info', {[OurLogKnownFieldKey.SEVERITY]: 'info'});

    const result = sortedIds(
      [info, error],
      [{field: OurLogKnownFieldKey.SEVERITY, kind: 'asc'}]
    );

    expect(result).toEqual(['error', 'info']);
  });

  it('falls back to the next sort when the first field ties', () => {
    const errorOld = logRow('error-old', {
      [OurLogKnownFieldKey.SEVERITY]: 'error',
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1_000,
    });
    const errorNew = logRow('error-new', {
      [OurLogKnownFieldKey.SEVERITY]: 'error',
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 2_000,
    });

    const result = sortedIds(
      [errorOld, errorNew],
      [
        {field: OurLogKnownFieldKey.SEVERITY, kind: 'asc'},
        {field: OurLogKnownFieldKey.TIMESTAMP, kind: 'desc'},
      ]
    );

    expect(result).toEqual(['error-new', 'error-old']);
  });

  it('preserves the original order when there are no sortBys', () => {
    const result = sortedIds([newer, older], []);

    expect(result).toEqual(['newer', 'older']);
  });

  it('falls back to the timestamp field when timestamp_precise cannot be parsed', () => {
    const olderInvalid = logRow('older', {
      [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-03T15:50:10+00:00',
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 'not-a-number',
    });
    const newerInvalid = logRow('newer', {
      [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-03T15:50:20+00:00',
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 'not-a-number',
    });

    const result = sortedIds(
      [olderInvalid, newerInvalid],
      [{field: OurLogKnownFieldKey.TIMESTAMP, kind: 'desc'}]
    );

    expect(result).toEqual(['newer', 'older']);
  });

  it('does not throw when timestamp_precise is not an integer', () => {
    const invalid = logRow('invalid', {
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1.5,
    });

    expect(() =>
      sortedIds([invalid, older], [{field: OurLogKnownFieldKey.TIMESTAMP, kind: 'desc'}])
    ).not.toThrow();
  });
});
