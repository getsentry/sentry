import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getBodySearchTerms} from 'sentry/views/explore/bodySearchTerms';

describe('getBodySearchTerms', () => {
  it('returns each free-text token', () => {
    const terms = getBodySearchTerms(new MutableSearch('billing success'), 'message');

    expect(terms).toEqual(['billing', 'success']);
  });

  it('splits a wildcard filter value into a term per segment', () => {
    const terms = getBodySearchTerms(
      new MutableSearch('message:*billing*success*'),
      'message'
    );

    expect(terms).toEqual(['billing', 'success']);
  });

  it('splits a free-text token that contains wildcards', () => {
    const terms = getBodySearchTerms(new MutableSearch('foo*bar'), 'message');

    expect(terms).toEqual(['foo', 'bar']);
  });

  it('keeps a filter value with no wildcards as a single term', () => {
    const terms = getBodySearchTerms(new MutableSearch('message:api.access'), 'message');

    expect(terms).toEqual(['api.access']);
  });

  it('reads the given body field for span descriptions', () => {
    const terms = getBodySearchTerms(
      new MutableSearch('span.description:*db*query*'),
      'span.description'
    );

    expect(terms).toEqual(['db', 'query']);
  });

  it('skips negated and list filter values', () => {
    const terms = getBodySearchTerms(
      new MutableSearch('!message:noise message:[a,b]'),
      'message'
    );

    expect(terms).toEqual([]);
  });
});
