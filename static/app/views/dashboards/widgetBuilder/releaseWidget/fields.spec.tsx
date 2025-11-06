import {
  generateReleaseWidgetFieldOptions,
  SESSIONS_FIELDS,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';

describe('generateReleaseWidgetFieldOptions', () => {
  const fields = Object.values(SESSIONS_FIELDS);
  const tagKeys = ['release', 'environment'];

  it('generates correct field options', () => {
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
      'function:abnormal_rate': {
        label: 'abnormal_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'abnormal_rate',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:anr_rate': {
        label: 'anr_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'anr_rate',
            parameters: [],
          },
        },
      },
      'function:count_abnormal': {
        label: 'count_abnormal(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'count_abnormal',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:count_crashed': {
        label: 'count_crashed(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'count_crashed',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:count_errored': {
        label: 'count_errored(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'count_errored',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:count_healthy': {
        label: 'count_healthy(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'count_healthy',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:count_unhandled': {
        label: 'count_unhandled(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'count_unhandled',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
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
      'function:crash_free_rate': {
        label: 'crash_free_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'crash_free_rate',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:crash_rate': {
        label: 'crash_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'crash_rate',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:errored_rate': {
        label: 'errored_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'errored_rate',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:foreground_anr_rate': {
        label: 'foreground_anr_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'foreground_anr_rate',
            parameters: [],
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
      'function:unhandled_rate': {
        label: 'unhandled_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'unhandled_rate',
            parameters: [
              {
                columnTypes: ['integer', 'string'],
                defaultValue: 'session',
                kind: 'column',
                required: true,
              },
            ],
          },
        },
      },
      'function:unhealthy_rate': {
        label: 'unhealthy_rate(…)',
        value: {
          kind: 'function',
          meta: {
            name: 'unhealthy_rate',
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
      'field:environment': {
        label: 'environment',
        value: {
          kind: 'field',
          meta: {
            dataType: 'string',
            name: 'environment',
          },
        },
      },
      'field:release': {
        label: 'release',
        value: {
          kind: 'field',
          meta: {
            dataType: 'string',
            name: 'release',
          },
        },
      },
    });
  });
});
