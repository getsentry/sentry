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

describe('alert embed schema', () => {
  it('exposes detectorId for detector-backed alerts', () => {
    const alert = seerEmbedsToJsonSchemas().find(widget => widget.name === 'alert');

    expect(alert).toMatchObject({
      description: expect.stringContaining('always include `detectorId`'),
      body: {
        properties: {
          detectorId: {type: 'string'},
        },
      },
    });
  });

  it('keeps detectorId optional for stored legacy embeds', () => {
    expect(
      SEER_EMBED_SCHEMAS.alert.schema.safeParse({id: '4521', kind: 'metric'}).success
    ).toBe(true);
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
