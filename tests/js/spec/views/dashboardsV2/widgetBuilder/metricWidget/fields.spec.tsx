import {
  generateReleaseWidgetFieldOptions,
  SESSION_FIELDS,
} from 'sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields';

describe('generateReleaseWidgetFieldOptions', function () {
  const fields = Object.keys(SESSION_FIELDS).map(key => SESSION_FIELDS[key]);
  const tagKeys = ['release', 'environment'];

  it('generates correct field options', function () {
    expect(generateReleaseWidgetFieldOptions(fields, tagKeys)).toEqual({
      'field:session': {
        label: 'session',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'integer',
            name: 'session',
          },
        },
      },
      'field:session.duration': {
        label: 'session.duration',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'duration',
            name: 'session.duration',
          },
        },
      },
      'field:user': {
        label: 'user',
        value: {
          kind: 'metric',
          meta: {
            dataType: 'string',
            name: 'user',
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
                columnTypes: ['duration'],
                defaultValue: 'session.duration',
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
                columnTypes: ['string'],
                defaultValue: 'user',
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
                columnTypes: ['duration'],
                defaultValue: 'session.duration',
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
                columnTypes: ['duration'],
                defaultValue: 'session.duration',
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
                columnTypes: ['duration'],
                defaultValue: 'session.duration',
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
                columnTypes: ['duration'],
                defaultValue: 'session.duration',
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
                columnTypes: ['duration'],
                defaultValue: 'session.duration',
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
                columnTypes: ['integer'],
                defaultValue: 'session',
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
    expect(generateReleaseWidgetFieldOptions([], tagKeys)).toEqual({});
  });
});
