import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {NumberInput} from '@sentry/scraps/input';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('NumberInput', () => {
  it('renders input', () => {
    render(<NumberInput value={5} aria-label="Test" />, {wrapper: ThemeWrapper});

    expect(screen.getByRole('textbox')).toHaveValue('5');
  });

  it('responds to key presses', async () => {
    render(<NumberInput defaultValue={5} aria-label="Test" />, {wrapper: ThemeWrapper});

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '{ArrowDown}');
    expect(input).toHaveValue('4');

    await userEvent.type(input, '{ArrowUp>2}');
    expect(input).toHaveValue('6');
  });

  it('responds to increment/decrement button clicks', async () => {
    render(<NumberInput defaultValue={5} aria-label="Test" />, {wrapper: ThemeWrapper});

    const input = screen.getByRole('textbox');
    await userEvent.click(screen.getByRole('button', {name: 'Decrease Test'}));
    expect(input).toHaveValue('4');

    await userEvent.click(screen.getByRole('button', {name: 'Increase Test'}));
    expect(input).toHaveValue('5');
  });

  it('forces min/max values', async () => {
    render(<NumberInput min={0} max={10} defaultValue={5} aria-label="Test" />, {
      wrapper: ThemeWrapper,
    });

    const input = screen.getByRole('textbox');

    // Should not be able to press arrow down to get below 0
    await userEvent.type(input, '{ArrowDown>5}');
    expect(input).toHaveValue('0');
    await userEvent.type(input, '{ArrowDown}');
    expect(input).toHaveValue('0');

    // Should not be able to press arrow up to get above 10
    await userEvent.type(input, '{ArrowUp>10}');
    expect(input).toHaveValue('10');
    await userEvent.type(input, '{ArrowUp}');
    expect(input).toHaveValue('10');

    // Type "100"
    await userEvent.type(input, '0');
    expect(input).toHaveValue('100');
    // Click outside the input, the value should be clamped down to 10
    await userEvent.click(document.body);
    expect(input).toHaveValue('10');
  });
});
