import {SEER_EMBED_SCHEMAS, seerEmbedsToJsonSchemas} from './schemas';

describe('seerEmbedsToJsonSchemas', () => {
  it('accepts inputs that the renderer fills with defaults or strips', () => {
    expect(
      SEER_EMBED_SCHEMAS.timestamp.schema.parse({
        value: '2025-07-15T14:30:00Z',
        extra: true,
      })
    ).toEqual({value: '2025-07-15T14:30:00Z', format: 'absolute'});
    expect(SEER_EMBED_SCHEMAS.spansQuery.schema.parse({})).toEqual({
      query: '',
      mode: 'samples',
    });

    const widgets = seerEmbedsToJsonSchemas();
    const timestamp = widgets.find(widget => widget.name === 'timestamp');
    const spansQuery = widgets.find(widget => widget.name === 'spansQuery');

    expect(timestamp?.body.required).toEqual(['value']);
    expect(timestamp?.body.additionalProperties).toBeUndefined();
    expect(spansQuery?.body.required).toBeUndefined();
  });

  it('exports chart axis restrictions to the agent contract', () => {
    const chart = seerEmbedsToJsonSchemas().find(widget => widget.name === 'chart');

    expect(chart?.body).toMatchObject({
      anyOf: [
        {
          required: ['title', 'series'],
          properties: {
            x_axis: {const: 'time', default: 'time'},
            series: {
              items: {
                anyOf: [
                  {
                    properties: {
                      data: {
                        items: {
                          properties: {
                            x: {type: 'string', pattern: expect.any(String)},
                          },
                        },
                      },
                    },
                  },
                  expect.any(Object),
                ],
              },
            },
          },
        },
        {
          required: ['title', 'visualization', 'x_axis', 'series'],
          properties: {
            x_axis: {const: 'category'},
            visualization: {const: 'bar'},
          },
        },
      ],
    });
  });

  it('documents the replay timestamp offset requirement in the agent contract', () => {
    const replay = seerEmbedsToJsonSchemas().find(widget => widget.name === 'replay');

    expect(replay).toMatchObject({
      description: expect.stringContaining('timezone offset'),
      body: {
        properties: {
          eventTimestamp: {
            description: expect.stringContaining('timezone offset'),
          },
        },
      },
    });
  });
});

describe('SEER_EMBED_SCHEMAS charts', () => {
  it.each(['label', 'name'])('accepts defaulted time charts with a series %s', key => {
    expect(
      SEER_EMBED_SCHEMAS.chart.schema.parse({
        title: 'Events',
        series: [{[key]: 'Count', data: [{x: '2025-07-15T14:30:00Z', y: 1}]}],
      })
    ).toMatchObject({visualization: 'line', x_axis: 'time', y_axis_unit: 'number'});
  });

  it.each([123, 'category', '2025-07-15T14:30:00', '2025-02-30T14:30:00Z'])(
    'rejects invalid time-axis value %s',
    x => {
      expect(
        SEER_EMBED_SCHEMAS.chart.schema.safeParse({
          title: 'Events',
          series: [{label: 'Count', data: [{x, y: 1}]}],
        }).success
      ).toBe(false);
    }
  );

  it.each([undefined, 'line', 'area', 'bar'])(
    'accepts category charts only with explicit bar visualization: %s',
    visualization => {
      expect(
        SEER_EMBED_SCHEMAS.chart.schema.safeParse({
          title: 'Events',
          x_axis: 'category',
          visualization,
          series: [
            {
              label: 'Count',
              data: [
                {x: 'a', y: 1},
                {x: 123, y: 2},
              ],
            },
          ],
        }).success
      ).toBe(visualization === 'bar');
    }
  );
});

describe('SEER_EMBED_SCHEMAS page filters', () => {
  it('accepts numeric project IDs for spansQuery', () => {
    const parsed = SEER_EMBED_SCHEMAS.spansQuery.schema.safeParse({
      mode: 'aggregate',
      query: 'span.op:pageload',
      projects: [11276],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.projects).toEqual([11276]);
    }
  });

  it('accepts start/end copied from a Sentry URL without an offset', () => {
    for (const name of ['spansQuery', 'errorsQuery'] as const) {
      const parsed = SEER_EMBED_SCHEMAS[name].schema.safeParse({
        start: '2026-09-07T22:53:00',
        end: '2026-09-11T10:02:00.000Z',
      });

      expect(parsed.success).toBe(true);
    }
  });

  it('rejects start/end that are not ISO datetimes', () => {
    const parsed = SEER_EMBED_SCHEMAS.spansQuery.schema.safeParse({
      start: 'Mon Sep 07 2026 15:53:00 GMT-0700',
    });

    expect(parsed.success).toBe(false);
  });

  it('exports projects as string or number in the agent JSON Schema', () => {
    const spansQuery = seerEmbedsToJsonSchemas().find(
      widget => widget.name === 'spansQuery'
    );

    expect(spansQuery?.body).toMatchObject({
      properties: {
        projects: {
          items: {
            anyOf: [{type: 'string'}, {type: 'number'}],
          },
        },
      },
    });
  });
});
