import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {OTPInput} from '@sentry/scraps/input';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('OTPInput', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => null),
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('accepts characters and reports a filled code', async () => {
    const onComplete = jest.fn();
    render(<OTPInput format="0000" onComplete={onComplete} />, {wrapper: ThemeWrapper});

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.type(input, '1234');

    expect(input).toHaveValue('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('supports one-time-code autofill', () => {
    render(<OTPInput format="000000" onComplete={jest.fn()} />, {wrapper: ThemeWrapper});

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toHaveAttribute(
      'autocomplete',
      'one-time-code'
    );
  });

  it('disables the native input', () => {
    render(<OTPInput disabled format="000000" onComplete={jest.fn()} />, {
      wrapper: ThemeWrapper,
    });

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toBeDisabled();
  });

  it('renders the requested number of visual slots', () => {
    render(<OTPInput format="000000" onComplete={jest.fn()} />, {wrapper: ThemeWrapper});

    // Slots are visual only; the accessible control is a single textbox.
    // oxlint-disable-next-line testing-library/no-node-access
    expect(document.querySelectorAll('[data-input-otp-slot]')).toHaveLength(6);
  });

  it('strips format separators from pasted numeric values', async () => {
    const onComplete = jest.fn();
    render(<OTPInput format="000-000" onComplete={onComplete} />, {
      wrapper: ThemeWrapper,
    });

    expect(screen.getByText('-')).toBeInTheDocument();

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.click(input);
    await userEvent.paste('123-456');

    expect(input).toHaveValue('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('strips format separators and uppercases pasted alphanumeric values', async () => {
    const onComplete = jest.fn();
    render(<OTPInput format="AA-AA" onComplete={onComplete} uppercase />, {
      wrapper: ThemeWrapper,
    });

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'One-time password',
    });
    await userEvent.click(input);
    await userEvent.paste('a1-b2');

    expect(input).toHaveValue('A1B2');
    expect(onComplete).toHaveBeenCalledWith('A1B2');
  });
});
