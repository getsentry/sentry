import {generateMetricsWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/metricWidget/fields';

describe('generateMetricsWidgetFieldOptions', function () {
  const fields = TestStubs.MetricsMeta();
  const tagKeys = ['release', 'environment'];

  it('generates correct field options', function () {
    expect(generateMetricsWidgetFieldOptions(fields, tagKeys)).toEqual({
      'field:sentry.sessions.session': {
        label: 'sentry.sessions.session',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'counter',
            name: 'sentry.sessions.session',
          },
        },
      },
      'field:sentry.sessions.session.error': {
        label: 'sentry.sessions.session.error',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'set',
            name: 'sentry.sessions.session.error',
          },
        },
      },
      'field:sentry.sessions.user': {
        label: 'sentry.sessions.user',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'set',
            name: 'sentry.sessions.user',
          },
        },
      },
      'field:sentry.transactions.measurements.fcp': {
        label: 'sentry.transactions.measurements.fcp',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'distribution',
            name: 'sentry.transactions.measurements.fcp',
          },
        },
      },
      'field:sentry.transactions.measurements.fid': {
        label: 'sentry.transactions.measurements.fid',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'distribution',
            name: 'sentry.transactions.measurements.fid',
          },
        },
      },
      'field:sentry.transactions.measurements.fp': {
        label: 'sentry.transactions.measurements.fp',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'distribution',
            name: 'sentry.transactions.measurements.fp',
          },
        },
      },
      'field:sentry.transactions.measurements.lcp': {
        label: 'sentry.transactions.measurements.lcp',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'distribution',
            name: 'sentry.transactions.measurements.lcp',
          },
        },
      },
      'field:sentry.transactions.measurements.ttfb': {
        label: 'sentry.transactions.measurements.ttfb',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'distribution',
            name: 'sentry.transactions.measurements.ttfb',
          },
        },
      },
      'field:sentry.transactions.measurements.ttfb.requesttime': {
        label: 'sentry.transactions.measurements.ttfb.requesttime',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'distribution',
            name: 'sentry.transactions.measurements.ttfb.requesttime',
          },
        },
      },
      'field:sentry.transactions.transaction.duration': {
        label: 'sentry.transactions.transaction.duration',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'distribution',
            name: 'sentry.transactions.transaction.duration',
          },
        },
      },
      'field:sentry.transactions.user': {
        label: 'sentry.transactions.user',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'set',
            name: 'sentry.transactions.user',
          },
        },
      },
      'function:avg': {
        label: 'avg(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'avg',
            parameters: [
              {
                columnTypes: ['distribution'],
                defaultValue: 'sentry.transactions.transaction.duration',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:count': {
        label: 'count(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'count',
            parameters: [
              {
                columnTypes: ['distribution'],
                defaultValue: 'sentry.transactions.transaction.duration',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:count_unique': {
        label: 'count_unique(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'count_unique',
            parameters: [
              {
                columnTypes: ['set'],
                defaultValue: 'sentry.sessions.user',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:max': {
        label: 'max(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'max',
            parameters: [
              {
                columnTypes: ['distribution'],
                defaultValue: 'sentry.transactions.transaction.duration',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:p50': {
        label: 'p50(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'p50',
            parameters: [
              {
                columnTypes: ['distribution'],
                defaultValue: 'sentry.transactions.transaction.duration',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:p75': {
        label: 'p75(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'p75',
            parameters: [
              {
                columnTypes: ['distribution'],
                defaultValue: 'sentry.transactions.transaction.duration',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:p95': {
        label: 'p95(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'p95',
            parameters: [
              {
                columnTypes: ['distribution'],
                defaultValue: 'sentry.transactions.transaction.duration',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:p99': {
        label: 'p99(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'p99',
            parameters: [
              {
                columnTypes: ['distribution'],
                defaultValue: 'sentry.transactions.transaction.duration',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:sum': {
        label: 'sum(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'sum',
            parameters: [
              {
                columnTypes: ['counter'],
                defaultValue: 'sentry.sessions.session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'tag:environment': {
        label: 'environment',
        value: {
          kind: 'tag',
          meta: {
            dataType: 'string',
            name: 'environment',
          },
        },
      },
      'tag:release': {
        label: 'release',
        value: {
          kind: 'tag',
          meta: {
            dataType: 'string',
            name: 'release',
          },
        },
      },
    });
  });

  it('ignores tags+aggregates if there are no fields', function () {
    expect(generateMetricsWidgetFieldOptions([], tagKeys)).toEqual({});
  });
});
