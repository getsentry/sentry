import {EXAMPLE_CITATIONS} from './__fixtures__/examples';
import {CITATION_KINDS, citationsToJsonSchema, parseCitation} from './schemas';

describe('citation schema', () => {
  it('has an example of every kind', () => {
    expect(new Set(EXAMPLE_CITATIONS.map(c => c.kind))).toEqual(new Set(CITATION_KINDS));
  });

  it.each(EXAMPLE_CITATIONS.map(c => [c.id, c] as const))(
    'parses %s',
    (_id, citation) => {
      expect(parseCitation(citation)).toEqual(citation);
    }
  );

  it('fills locator defaults', () => {
    expect(
      parseCitation({
        id: 'c_q0001',
        kind: 'query',
        title: 'All spans',
        locator: {dataset: 'spans'},
      })
    ).toMatchObject({locator: {dataset: 'spans', query: ''}});
  });

  it('exports one JSON schema branch per kind', () => {
    const schema = citationsToJsonSchema();
    expect(schema.kinds).toEqual(CITATION_KINDS);
    expect(schema.oneOf).toHaveLength(CITATION_KINDS.length);
  });

  it('rejects unknown kinds and malformed locators', () => {
    expect(
      parseCitation({id: 'c_abcd', kind: 'tweet', title: 'x', locator: {}})
    ).toBeNull();
    expect(
      parseCitation({id: 'c_abcd', kind: 'event', title: 'x', locator: {eventId: 'nope'}})
    ).toBeNull();
    expect(
      parseCitation({
        id: 'not-a-ledger-id',
        kind: 'external',
        title: 'x',
        locator: {url: 'https://a.b'},
      })
    ).toBeNull();
  });
});
