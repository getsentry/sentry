import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {ParseResult, TokenResult} from 'sentry/components/searchSyntax/parser';
import {FilterType, TermOperator, Token} from 'sentry/components/searchSyntax/parser';

import HighlightQuery from './renderer';

const query: ParseResult = [
  {
    type: Token.FILTER,
    filter: FilterType.TEXT,
    negated: false,
    key: {
      type: Token.KEY_SIMPLE,
      value: 'user.email',
      quoted: false,
      text: 'user.email',
      location: {
        start: {offset: 0, line: 1, column: 1},
        end: {offset: 10, line: 1, column: 11},
        source: {},
      },
    },
    operator: TermOperator.DEFAULT,
    value: {
      type: Token.VALUE_TEXT,
      value: 'foo@example.com',
      quoted: false,
      text: 'foo@example.com',
      location: {
        start: {offset: 11, line: 1, column: 12},
        end: {offset: 27, line: 1, column: 28},
        source: {},
      },
    },
    invalid: null,
    warning: null,
    text: 'user.email:foo@example.com',
    location: {
      start: {offset: 0, line: 1, column: 1},
      end: {offset: 27, line: 1, column: 28},
      source: {},
    },
  } satisfies TokenResult<Token.FILTER>,
];

describe('SmartSearchBar', function () {
  it('renders the query', function () {
    render(<HighlightQuery parsedQuery={query} cursorPosition={-1} />);

    expect(screen.getByText('user.email:')).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();
  });
});
