import {render, screen} from 'sentry-test/reactTestingLibrary';

import {HighlightText} from '@sentry/scraps/compactSelect';

describe('HighlightText', () => {
  it('highlights the matched substring', () => {
    render(<HighlightText text="span.description" query="desc" />);

    const match = screen.getByTestId('sqb-highlighted-match');
    expect(match).toHaveTextContent('desc');
  });

  it('matches case-insensitively', () => {
    render(<HighlightText text="Span.Description" query="DESC" />);

    expect(screen.getByTestId('sqb-highlighted-match')).toHaveTextContent('Desc');
  });

  it('exposes the full text via aria-label for screen readers', () => {
    render(<HighlightText text="span.description" query="desc" />);

    expect(screen.getByLabelText('span.description')).toBeInTheDocument();
  });

  it('renders plain text when the query is empty', () => {
    render(<HighlightText text="span.description" query="" />);

    expect(screen.queryByTestId('sqb-highlighted-match')).not.toBeInTheDocument();
    expect(screen.getByText('span.description')).toBeInTheDocument();
  });

  it('renders plain text when there is no match', () => {
    render(<HighlightText text="span.description" query="zzz" />);

    expect(screen.queryByTestId('sqb-highlighted-match')).not.toBeInTheDocument();
    expect(screen.getByText('span.description')).toBeInTheDocument();
  });
});
