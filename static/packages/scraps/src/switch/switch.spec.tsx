import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {Switch} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Switch', () => {
  it('disabled', () => {
    render(<Switch disabled />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('checked', () => {
    render(<Switch checked onChange={jest.fn()} />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('disallows toggling a disabled switch', async () => {
    const onClick = jest.fn();

    render(<Switch disabled onChange={onClick} />, {wrapper: ThemeWrapper});

    const switchButton = screen.getByRole('checkbox');
    expect(switchButton).not.toBeChecked();

    await userEvent.click(switchButton);
    expect(switchButton).not.toBeChecked();
    expect(onClick).not.toHaveBeenCalled();
  });
});
