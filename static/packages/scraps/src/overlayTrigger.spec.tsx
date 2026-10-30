import type * as React from 'react';
import {createRef} from 'react';
import {ThemeProvider} from '@emotion/react';
import {IconSearch} from '@sentry/icons/search';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {ControlContext} from '@sentry/scraps/menu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

it('shares open and disabled state with selection controls', () => {
  render(
    <ControlContext
      value={{
        overlayIsOpen: true,
        disabled: true,
        size: 'sm',
        search: '',
        searchable: false,
      }}
    >
      <OverlayTrigger.Button>Options</OverlayTrigger.Button>
    </ControlContext>,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByRole('button', {name: 'Options'})).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  expect(screen.getByRole('button', {name: 'Options'})).toBeDisabled();
});

it('forwards refs and keyboard activation', async () => {
  const ref = createRef<HTMLButtonElement>();
  const onKeyDown = jest.fn();
  render(
    <OverlayTrigger.Button ref={ref} onKeyDown={onKeyDown}>
      Options
    </OverlayTrigger.Button>,
    {
      wrapper: ThemeWrapper,
    }
  );

  await userEvent.tab();
  expect(ref.current).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(onKeyDown).toHaveBeenCalled();
});

it('keeps an accessible icon trigger', () => {
  const ref = createRef<HTMLButtonElement>();
  render(
    <OverlayTrigger.IconButton aria-label="Search" icon={<IconSearch />} ref={ref} />,
    {
      wrapper: ThemeWrapper,
    }
  );

  expect(ref.current).toBe(screen.getByRole('button', {name: 'Search'}));
  expect(ref.current).toHaveAttribute('aria-expanded', 'false');
});
