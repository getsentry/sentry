import {serializeComposerValue} from './serializeComposerValue';

describe('serializeComposerValue', () => {
  it('preserves plain text and markdown', () => {
    expect(serializeComposerValue({text: '  **Hello** `world`\n', mentions: []})).toBe(
      '  **Hello** `world`\n'
    );
  });

  it('serializes selected users and teams while preserving surrounding text', () => {
    expect(
      serializeComposerValue({
        text: 'Ask @Jane Doe and @platform.',
        mentions: [
          {id: 'user:1', sourceId: 'members', text: '@Jane Doe', start: 4, end: 13},
          {id: 'team:2', sourceId: 'teams', text: '@platform', start: 18, end: 27},
        ],
      })
    ).toBe(
      'Ask {% user %}{"id":"1","type":"user","name":"Jane Doe"}{% /user %} and ' +
        '{% user %}{"id":"2","type":"team","name":"platform"}{% /user %}.'
    );
  });

  it('leaves edited mentions and unrelated suggestion sources as plain text', () => {
    expect(
      serializeComposerValue({
        text: '@Janet /new',
        mentions: [
          {id: 'user:1', sourceId: 'members', text: '@Jane', start: 0, end: 6},
          {id: 'new', sourceId: 'commands', text: '/new', start: 7, end: 11},
        ],
      })
    ).toBe('@Janet /new');
  });

  it('escapes JSON and tag delimiters in mention labels', () => {
    const text = '@Jane "{% /user %}"';
    const serialized = serializeComposerValue({
      text,
      mentions: [{id: 'user:1', sourceId: 'members', text, start: 0, end: text.length}],
    });

    expect(serialized.match(/\{% \/user %\}/g)).toHaveLength(1);
    expect(
      JSON.parse(serialized.slice('{% user %}'.length, -'{% /user %}'.length))
    ).toEqual({
      id: '1',
      type: 'user',
      name: 'Jane "{% /user %}"',
    });
  });

  it('ignores mention ranges outside the text', () => {
    expect(
      serializeComposerValue({
        text: '@Jane',
        mentions: [{id: 'user:1', sourceId: 'members', text: '@Jane', start: 0, end: 99}],
      })
    ).toBe('@Jane');
  });
});
