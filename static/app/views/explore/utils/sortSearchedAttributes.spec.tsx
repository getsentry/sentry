import {prettifyTagKey} from 'sentry/utils/fields';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  sortKnownAttributes,
  sortSearchedAttributes,
} from 'sentry/views/explore/utils/sortSearchedAttributes';

function rank(values: string[], searchText: string) {
  return values
    .map(value => ({key: value, value, label: prettifyTagKey(value), textValue: value}))
    .toSorted((a, b) => sortKnownAttributes(a, b, TraceItemDataset.LOGS))
    .map(option => ({
      value: option.value,
      score: sortSearchedAttributes({
        fieldDefinitionType: TraceItemDataset.LOGS,
        option,
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

  it.each(['mess', 'messa', 'message'])(
    'keeps a user attribute right after its Sentry field when searching %s',
    searchText => {
      const ranked = rank(
        ['message.parameter.0', 'tags[message,string]', 'message.template', 'message'],
        searchText
      );
      expect(ranked.slice(0, 2)).toEqual(['message', 'tags[message,string]']);
    }
  );

  it.each(['i', 'id'])(
    'keeps a user number attribute right after its Sentry field when searching %s',
    searchText => {
      const ranked = rank(['tags[id,number]', 'id.foo', 'id'], searchText);
      expect(ranked.slice(0, 2)).toEqual(['id', 'tags[id,number]']);
    }
  );

  it('still matches explicitly typed keys by their tag syntax', () => {
    expect(rank(['tags[message,string]', 'message'], 'tags[')).toEqual([
      'tags[message,string]',
    ]);
  });
});
