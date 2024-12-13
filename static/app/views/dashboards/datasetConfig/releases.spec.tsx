import {SessionUserCountByStatusByReleaseFixture} from 'sentry-fixture/sessions';

import {transformSessionsResponseToTable} from 'sentry/views/dashboards/datasetConfig/releases';

describe('transformSessionsResponseToTable', function () {
  const widgetQuery = {
    name: '',
    fields: ['count_unique(user)', 'sum(session)', 'release', 'session.status'],
    columns: ['release', 'session.status'],
    aggregates: ['count_unique(user)', 'sum(session)'],
    conditions: '',
    orderby: '',
  };
  it('transforms sessions into table', () => {
    expect(
      transformSessionsResponseToTable(
        SessionUserCountByStatusByReleaseFixture(),
        widgetQuery
      )
    ).toEqual({
      data: [
        {
          'count_unique(user)': 1,
          id: '0',
          release: '1',
          'session.status': 'crashed',
          'sum(session)': 34,
        },
        {
          'count_unique(user)': 1,
          id: '1',
          release: '1',
          'session.status': 'abnormal',
          'sum(session)': 1,
        },
        {
          'count_unique(user)': 2,
          id: '2',
          release: '1',
          'session.status': 'errored',
          'sum(session)': 451,
        },
        {
          'count_unique(user)': 3,
          id: '3',
          release: '1',
          'session.status': 'healthy',
          'sum(session)': 5058,
        },
        {
          'count_unique(user)': 2,
          id: '4',
          release: '2',
          'session.status': 'crashed',
          'sum(session)': 35,
        },
        {
          'count_unique(user)': 1,
          id: '5',
          release: '2',
          'session.status': 'abnormal',
          'sum(session)': 1,
        },
        {
          'count_unique(user)': 1,
          id: '6',
          release: '2',
          'session.status': 'errored',
          'sum(session)': 452,
        },
        {
          'count_unique(user)': 10,
          id: '7',
          release: '2',
          'session.status': 'healthy',
          'sum(session)': 5059,
        },
      ],
      meta: {
        'count_unique(user)': 'integer',
        release: 'string',
        'session.status': 'string',
        'sum(session)': 'integer',
        fields: {
          'count_unique(user)': 'integer',
          release: 'string',
          'session.status': 'string',
          'sum(session)': 'integer',
        },
      },
    });
  });
  it('adds derived metric fields', () => {
    expect(
      transformSessionsResponseToTable(SessionUserCountByStatusByReleaseFixture(), {
        ...widgetQuery,
        aggregates: ['count_unique(user)', 'sum(session)', 'count_crashed(session)'],
      })
    ).toEqual({
      data: [
        {
          'count_crashed(session)': 34,
          'count_unique(user)': 1,
          id: '0',
          release: '1',
          'session.status': 'crashed',
          'sum(session)': 34,
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 1,
          id: '1',
          release: '1',
          'session.status': 'abnormal',
          'sum(session)': 1,
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 2,
          id: '2',
          release: '1',
          'session.status': 'errored',
          'sum(session)': 451,
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 3,
          id: '3',
          release: '1',
          'session.status': 'healthy',
          'sum(session)': 5058,
        },
        {
          'count_crashed(session)': 35,
          'count_unique(user)': 2,
          id: '4',
          release: '2',
          'session.status': 'crashed',
          'sum(session)': 35,
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 1,
          id: '5',
          release: '2',
          'session.status': 'abnormal',
          'sum(session)': 1,
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 1,
          id: '6',
          release: '2',
          'session.status': 'errored',
          'sum(session)': 452,
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 10,
          id: '7',
          release: '2',
          'session.status': 'healthy',
          'sum(session)': 5059,
        },
      ],
      meta: {
        'count_crashed(session)': 'integer',
        'count_unique(user)': 'integer',
        release: 'string',
        'session.status': 'string',
        'sum(session)': 'integer',
        fields: {
          'count_crashed(session)': 'integer',
          'count_unique(user)': 'integer',
          release: 'string',
          'session.status': 'string',
          'sum(session)': 'integer',
        },
      },
    });
  });
  it('strips away injected fields', () => {
    expect(
      transformSessionsResponseToTable(SessionUserCountByStatusByReleaseFixture(), {
        ...widgetQuery,
        aggregates: ['count_unique(user)', 'count_crashed(session)'],
      })
    ).toEqual({
      data: [
        {
          'count_crashed(session)': 34,
          'count_unique(user)': 1,
          id: '0',
          release: '1',
          'session.status': 'crashed',
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 1,
          id: '1',
          release: '1',
          'session.status': 'abnormal',
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 2,
          id: '2',
          release: '1',
          'session.status': 'errored',
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 3,
          id: '3',
          release: '1',
          'session.status': 'healthy',
        },
        {
          'count_crashed(session)': 35,
          'count_unique(user)': 2,
          id: '4',
          release: '2',
          'session.status': 'crashed',
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 1,
          id: '5',
          release: '2',
          'session.status': 'abnormal',
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 1,
          id: '6',
          release: '2',
          'session.status': 'errored',
        },
        {
          'count_crashed(session)': 0,
          'count_unique(user)': 10,
          id: '7',
          release: '2',
          'session.status': 'healthy',
        },
      ],
      meta: {
        'count_crashed(session)': 'integer',
        'count_unique(user)': 'integer',
        release: 'string',
        'session.status': 'string',
        fields: {
          'count_crashed(session)': 'integer',
          'count_unique(user)': 'integer',
          release: 'string',
          'session.status': 'string',
        },
      },
    });
  });
});
