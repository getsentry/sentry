import {seerEmbedsToJsonSchemas} from './schemas';

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
