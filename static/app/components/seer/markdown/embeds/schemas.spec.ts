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
