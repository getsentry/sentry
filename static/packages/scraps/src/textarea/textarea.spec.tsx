import type * as React from 'react';
import {createRef} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {TextArea} from './textarea';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

it('forwards the ref, rows, and native input behavior', async () => {
  const ref = createRef<HTMLTextAreaElement>();
  render(<TextArea ref={ref} aria-label="Description" rows={4} />, {
    wrapper: ThemeWrapper,
  });

  const textarea = screen.getByRole('textbox', {name: 'Description'});
  expect(ref.current).toBe(textarea);
  expect(textarea).toHaveAttribute('rows', '4');
  await userEvent.type(textarea, 'Description text');
  expect(textarea).toHaveValue('Description text');
});

it('preserves disabled behavior and the default row count', () => {
  render(<TextArea aria-label="Description" disabled />, {wrapper: ThemeWrapper});
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('textbox')).toHaveAttribute('rows', '3');
});

it('observes autosized textarea width and preserves the forwarded ref', () => {
  const observe = jest.spyOn(ResizeObserver.prototype, 'observe');
  const ref = createRef<HTMLTextAreaElement>();
  try {
    render(<TextArea ref={ref} autosize rows={2} maxRows={5} />, {
      wrapper: ThemeWrapper,
    });
    expect(ref.current).toBe(screen.getByRole('textbox'));
    expect(observe).toHaveBeenCalledWith(ref.current, {box: 'border-box'});
  } finally {
    observe.mockRestore();
  }
});
