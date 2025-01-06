import {getTableData} from 'sentry/views/dashboards/metrics/table';

const queries = [
  {
    name: 'a',
    mri: 'd:custom/sentry.event_manager.save@second',
    aggregation: 'p50',
    groupBy: ['consumer_group', 'event_type'],
  },
  {
    name: 'b',
    mri: 'd:custom/sentry.event_manager.save_attachments@second',
    aggregation: 'p90',
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
      {order: undefined, label: 'consumer_group', name: 'consumer_group', type: 'tag'},
      {order: undefined, label: 'event_type', name: 'event_type', type: 'tag'},
      {
        order: undefined,
        label: 'p50(sentry.event_manager.save)',
        name: 'a',
        type: 'field',
        id: undefined,
      },
      {
        order: undefined,
        label: 'p90(sentry.event_manager.save_attachments)',
        name: 'b',
        type: 'field',
        id: undefined,
      },
    ]);

    expect(result.rows).toHaveLength(7);
    const ingestRow = result.rows[2]!;

    expect(ingestRow.a!.value).toBeDefined();
    expect(ingestRow.b!.value).toBeUndefined();

    const defaultRow = result.rows[5]!;
    expect(defaultRow.a!.value).toBeDefined();
    expect(defaultRow.b!.value).toBeDefined();
  });
});
