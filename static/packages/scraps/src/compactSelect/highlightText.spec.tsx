import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {HighlightText} from '@sentry/scraps/compactSelect';
import {lightTheme} from '@sentry/scraps/theme';

describe('HighlightText', () => {
  it('highlights the matched substring', () => {
    render(<HighlightText text="span.description" query="desc" />, {
      wrapper: ThemeWrapper,
    });

    const match = screen.getByTestId('sqb-highlighted-match');
    expect(match).toHaveTextContent('desc');
  });

  it('matches case-insensitively', () => {
    render(<HighlightText text="Span.Description" query="DESC" />, {
      wrapper: ThemeWrapper,
    });

    expect(screen.getByTestId('sqb-highlighted-match')).toHaveTextContent('Desc');
  });

  it('exposes the full text via aria-label for screen readers', () => {
    render(<HighlightText text="span.description" query="desc" />, {
      wrapper: ThemeWrapper,
    });

    expect(screen.getByLabelText('span.description')).toBeInTheDocument();
  });

  it('renders plain text when the query is empty', () => {
    render(<HighlightText text="span.description" query="" />, {wrapper: ThemeWrapper});

    expect(screen.queryByTestId('sqb-highlighted-match')).not.toBeInTheDocument();
    expect(screen.getByText('span.description')).toBeInTheDocument();
  });

  it('renders plain text when there is no match', () => {
    render(<HighlightText text="span.description" query="zzz" />, {
      wrapper: ThemeWrapper,
    });

    expect(screen.queryByTestId('sqb-highlighted-match')).not.toBeInTheDocument();
    expect(screen.getByText('span.description')).toBeInTheDocument();
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
