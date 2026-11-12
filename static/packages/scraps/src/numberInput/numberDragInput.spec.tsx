import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {NumberDragInput} from './numberDragInput';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

it('steps by the configured amount, clamps bounds, and dispatches changes', async () => {
  const onChange = jest.fn();
  render(
    <NumberDragInput
      aria-label="Threshold"
      defaultValue={2}
      min={0}
      max={4}
      step={2}
      onChange={onChange}
    />,
    {wrapper: ThemeWrapper}
  );
  const input = screen.getByRole('textbox', {name: 'Threshold'});
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowUp}{ArrowUp}');
  expect(input).toHaveValue('4');
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
  expect(input).toHaveValue('0');
  expect(onChange).toHaveBeenCalledTimes(3);
});
