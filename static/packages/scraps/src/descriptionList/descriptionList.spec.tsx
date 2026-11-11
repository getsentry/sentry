import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('DescriptionList', () => {
  it('renders terms and details as a description list when composed with its parts', () => {
    render(
      <DescriptionList data-test-id="list">
        <DescriptionList.Term>Occurred</DescriptionList.Term>
        <DescriptionList.Details>Jan 1, 2026</DescriptionList.Details>
      </DescriptionList>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByTestId('list').tagName).toBe('DL');
    expect(screen.getByRole('term')).toHaveTextContent('Occurred');
    expect(screen.getByRole('definition')).toHaveTextContent('Jan 1, 2026');
  });

  it('does not forward the gap prop to the DOM when one is provided', () => {
    render(<DescriptionList gap="xs" data-test-id="list" />, {wrapper: ThemeWrapper});

    expect(screen.getByTestId('list')).not.toHaveAttribute('gap');
  });

  it('does not forward the nowrap prop to the DOM when one is provided', () => {
    render(<DescriptionList nowrap data-test-id="list" />, {wrapper: ThemeWrapper});

    expect(screen.getByTestId('list')).not.toHaveAttribute('nowrap');
  });

  it('does not forward the terms prop to the DOM when one is provided', () => {
    render(<DescriptionList terms="strong" data-test-id="list" />, {
      wrapper: ThemeWrapper,
    });

    expect(screen.getByTestId('list')).not.toHaveAttribute('terms');
  });

  it('does not forward the striped prop to the DOM when one is provided', () => {
    render(<DescriptionList striped data-test-id="list" />, {wrapper: ThemeWrapper});

    expect(screen.getByTestId('list')).not.toHaveAttribute('striped');
  });
});
