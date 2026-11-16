import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Radio} from '@sentry/scraps/radio';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('radio', () => {
  it('disabled', () => {
    render(<Radio disabled />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('radio')).toBeDisabled();
  });

  it('checked', () => {
    render(<Radio checked onChange={jest.fn()} />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('disallows toggling a disabled radio', async () => {
    const onClick = jest.fn();

    render(<Radio disabled onChange={onClick} />, {wrapper: ThemeWrapper});

    const radioButton = screen.getByRole('radio');
    expect(radioButton).not.toBeChecked();

    await userEvent.click(radioButton);
    expect(radioButton).not.toBeChecked();
    expect(onClick).not.toHaveBeenCalled();
  });
});
