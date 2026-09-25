import {render, screen} from 'sentry-test/reactTestingLibrary';

import {loadPrismLanguage} from '@sentry/scraps/code';

import {HighlightedRegexPattern} from 'sentry/components/searchQueryBuilder/tokens/filter/highlightedRegexPattern';

jest.unmock('prismjs');

describe('HighlightedRegexPattern', () => {
  beforeAll(async () => {
    await loadPrismLanguage('regex', {});
  });

  it('marks up anchors, character sets, and quantifiers when given a pattern', () => {
    render(<HighlightedRegexPattern pattern="^GET /api/\d+$" />);

    expect(screen.getByText('^')).toHaveClass('anchor');
    expect(screen.getByText('GET /api/')).toBeInTheDocument();
    expect(screen.getByText('\\d')).toHaveClass('char-set');
    expect(screen.getByText('+')).toHaveClass('quantifier');
    expect(screen.getByText('$')).toHaveClass('anchor');
  });

  it('marks up the brackets and range when given a character class', () => {
    render(<HighlightedRegexPattern pattern="[a-z]{2,3}" />);

    expect(screen.getByText('[')).toHaveClass('char-class-punctuation');
    expect(screen.getByText('-')).toHaveClass('range-punctuation');
    expect(screen.getByText(']')).toHaveClass('char-class-punctuation');
    expect(screen.getByText('{2,3}')).toHaveClass('quantifier');
  });

  it('marks up the group and keeps the text when given a half-typed pattern', () => {
    render(<HighlightedRegexPattern pattern="(foo" />);

    expect(screen.getByText('(')).toHaveClass('group');
    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('keeps the ellipsis when given a middle-truncated pattern', () => {
    render(<HighlightedRegexPattern pattern="^abc…xyz$" />);

    expect(screen.getByText('abc…xyz')).toBeInTheDocument();
  });

  it('renders no markup when given a pattern of only literals', () => {
    render(<HighlightedRegexPattern pattern="firefox" />);

    expect(screen.getByText('firefox')).toBeInTheDocument();
    expect(screen.queryByText('firefox', {selector: 'span'})).not.toBeInTheDocument();
  });
});
