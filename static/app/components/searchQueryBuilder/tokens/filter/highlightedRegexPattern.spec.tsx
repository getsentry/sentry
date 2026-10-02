import {render, screen} from 'sentry-test/reactTestingLibrary';

import {loadPrismLanguage} from '@sentry/scraps/code';

import {renderRegexPattern} from 'sentry/components/searchQueryBuilder/tokens/filter/highlightedRegexPattern';

jest.unmock('prismjs');

describe('renderRegexPattern', () => {
  beforeAll(async () => {
    await loadPrismLanguage('regex', {});
  });

  it('marks up anchors, character sets, and quantifiers when given a pattern', () => {
    render(renderRegexPattern('^GET /api/\\d+$'));

    expect(screen.getByText('^')).toHaveClass('anchor');
    expect(screen.getByText('GET /api/')).toBeInTheDocument();
    expect(screen.getByText('\\d')).toHaveClass('char-set');
    expect(screen.getByText('+')).toHaveClass('quantifier');
    expect(screen.getByText('$')).toHaveClass('anchor');
  });

  it('marks up the brackets and range when given a character class', () => {
    render(renderRegexPattern('[a-z]{2,3}'));

    expect(screen.getByText('[')).toHaveClass('char-class-punctuation');
    expect(screen.getByText('-')).toHaveClass('range-punctuation');
    expect(screen.getByText(']')).toHaveClass('char-class-punctuation');
    expect(screen.getByText('{2,3}')).toHaveClass('quantifier');
  });

  it('marks up the group and keeps the text when given a half-typed pattern', () => {
    render(renderRegexPattern('(foo'));

    expect(screen.getByText('(')).toHaveClass('group');
    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('keeps the ellipsis when given a middle-truncated pattern', () => {
    render(renderRegexPattern('^abc…xyz$'));

    expect(screen.getByText('abc…xyz')).toBeInTheDocument();
  });

  it('renders the text when given a pattern of only literals', () => {
    render(renderRegexPattern('firefox'));

    expect(screen.getByText('firefox')).toBeInTheDocument();
  });
});
