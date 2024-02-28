import {getTableData} from 'sentry/views/dashboards/metrics/table';

const queries = [
  {
    name: 'a',
    mri: 'd:custom/sentry.event_manager.save@second',
    op: 'p50',
    groupBy: ['consumer_group', 'event_type'],
  },
  {
    name: 'b',
    mri: 'd:custom/sentry.event_manager.save_attachments@second',
    op: 'p90',
    groupBy: ['event_type'],
  },
];

const data = [
  [
    {
      by: {
        consumer_group: '',
        event_type: '',
      },
      series: [],
      totals: 0.3751704159949441,
    },
    {
      by: {
        consumer_group: '',
        event_type: 'error',
      },
      series: [],
      totals: 0.13256912349970662,
    },
    {
      by: {
        consumer_group: 'ingest-occurrences-0',
        event_type: '',
      },
      series: [],
      totals: 0.11766651156358421,
    },
    {
      by: {
        consumer_group: '',
        event_type: 'transaction',
      },
      series: [],
      totals: 0.11107462100335397,
    },
    {
      by: {
        consumer_group: '',
        event_type: 'default',
      },
      series: [],
      totals: 0.10583872749703004,
    },
    {
      by: {
        consumer_group: '',
        event_type: 'csp',
      },
      series: [],
      totals: 0.1013268940441776,
    },
    {
      by: {
        consumer_group: '',
        event_type: 'nel',
      },
      series: [],
      totals: 0.06116106499985108,
    },
  ],
  [
    {
      by: {
        event_type: '',
      },
      series: [],
      totals: 0.000006055769335944205,
    },
    {
      by: {
        event_type: 'default',
      },
      series: [],
      totals: 0.000004693902155850083,
    },
    {
      by: {
        event_type: 'error',
      },
      series: [],
      totals: 0.0000046898378059268,
    },
    {
      by: {
        event_type: 'csp',
      },
      series: [],
      totals: 0.000004462950164452195,
    },
    {
      by: {
        event_type: 'nel',
      },
      series: [],
      totals: 0.000004437007009983063,
    },
  ],
];

describe('getTableSeries', () => {
  it('should return table series', () => {
    // @ts-expect-error
    const result = getTableData({data, meta: []}, queries);

    expect(result.headers).toEqual([
      {name: 'consumer_group', type: 'tag'},
      {name: 'event_type', type: 'tag'},
      {name: 'p50(d:custom/sentry.event_manager.save@second)', type: 'field'},
      {name: 'p90(d:custom/sentry.event_manager.save_attachments@second)', type: 'field'},
    ]);

    expect(result.rows.length).toEqual(7);

    const ingestRow = result.rows.find(
      row => row.consumer_group === 'ingest-occurrences-0'
    )!;

    expect(ingestRow['p50(d:custom/sentry.event_manager.save@second)']).toBeDefined();
    expect(
      ingestRow['p90(d:custom/sentry.event_manager.save_attachments@second)']
    ).toBeUndefined();

    const defaultRow = result.rows.find(row => row.event_type === 'default')!;
    expect(defaultRow['p50(d:custom/sentry.event_manager.save@second)']).toBeDefined();
    expect(
      defaultRow['p90(d:custom/sentry.event_manager.save_attachments@second)']
    ).toBeDefined();
  });
});
