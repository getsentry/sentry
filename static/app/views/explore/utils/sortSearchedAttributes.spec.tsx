import {TraceItemDataset} from 'sentry/views/explore/types';
import {sortSearchedAttributes} from 'sentry/views/explore/utils/sortSearchedAttributes';

function rank(values: string[], searchText: string) {
  return values
    .map(value => ({
      value,
      score: sortSearchedAttributes({
        fieldDefinitionType: TraceItemDataset.LOGS,
        option: {key: value, value, label: value, textValue: value},
        searchText,
      }).score,
    }))
    .filter(({score}) => score > 0)
    .toSorted((a, b) => b.score - a.score)
    .map(({value}) => value);
}

describe('sortSearchedAttributes', () => {
  it('does not match options that do not contain the search text', () => {
    expect(rank(['severity', 'trace'], 'message')).toEqual([]);
  });

  it('ranks exact name matches above prefix matches', () => {
    expect(rank(['message.template', 'message'], 'message')).toEqual([
      'message',
      'message.template',
    ]);
  });

  it('ranks a user attribute that shares a Sentry field name right after it', () => {
    const ranked = rank(
      ['message.parameter.0', 'tags[message,string]', 'message.template', 'message'],
      'message'
    );
    expect(ranked.slice(0, 2)).toEqual(['message', 'tags[message,string]']);
    expect(ranked).toHaveLength(4);
  });

  it('still matches explicitly typed keys by their tag syntax', () => {
    expect(rank(['tags[message,string]', 'message'], 'tags[')).toEqual([
      'tags[message,string]',
    ]);
  });
});
