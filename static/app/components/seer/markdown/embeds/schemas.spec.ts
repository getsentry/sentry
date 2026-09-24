import {SEER_EMBED_SCHEMAS, seerEmbedsToJsonSchemas} from './schemas';

describe('seerEmbedsToJsonSchemas', () => {
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
