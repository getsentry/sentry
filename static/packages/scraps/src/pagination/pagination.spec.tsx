import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {Pagination, PaginationBehaviorContextProvider} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

it('supports opaque cursors and keyboard navigation without a router', async () => {
  const onCursor = jest.fn();
  render(
    <Pagination
      previous={{cursor: 'before'}}
      next={{cursor: 'after'}}
      onCursor={onCursor}
    />,
    {wrapper: ThemeWrapper}
  );
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
  expect(onCursor).toHaveBeenLastCalledWith('before', -1);
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
  expect(onCursor).toHaveBeenLastCalledWith('after', 1);
});

it('disables unavailable directions and responds to controlled updates', async () => {
  const onCursor = jest.fn();
  const {rerender} = render(<Pagination next={{cursor: 'after'}} onCursor={onCursor} />, {
    wrapper: ThemeWrapper,
  });
  expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
  rerender(
    <Pagination
      previous={{cursor: 'before'}}
      next={{cursor: 'after', disabled: true}}
      onCursor={onCursor}
    />
  );
  expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();
  expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
  expect(onCursor).not.toHaveBeenCalled();
});

it('disables interaction during loading while preserving caption', async () => {
  const onCursor = jest.fn();
  render(
    <Pagination
      previous={{cursor: 'before'}}
      next={{cursor: 'after'}}
      onCursor={onCursor}
      disabled
      caption="1–25 of 100"
    />,
    {wrapper: ThemeWrapper}
  );
  expect(screen.getByText('1–25 of 100')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
  await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
  expect(onCursor).not.toHaveBeenCalled();
});

it('reports directions after enabled clicks', async () => {
  const onCursor = jest.fn();
  render(<Pagination previous={{}} next={{}} onCursor={onCursor} />, {
    wrapper: ThemeWrapper,
  });
  await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
  expect(onCursor).toHaveBeenLastCalledWith(undefined, -1);
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
  expect(onCursor).toHaveBeenLastCalledWith(undefined, 1);
});

it('uses shared navigation and observes changes while allowing per-instance overrides', async () => {
  const navigate = jest.fn();
  const onPageChange = jest.fn();
  const onCursor = jest.fn();
  const {rerender} = render(
    <PaginationBehaviorContextProvider value={navigate}>
      <Pagination next={{cursor: 'next'}} onPageChange={onPageChange} />
    </PaginationBehaviorContextProvider>,
    {wrapper: ThemeWrapper}
  );
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
  expect(navigate).toHaveBeenCalledWith('next', 1);
  expect(onPageChange).toHaveBeenCalledWith('next', 1);

  navigate.mockClear();
  onPageChange.mockClear();
  rerender(
    <PaginationBehaviorContextProvider value={navigate}>
      <Pagination
        next={{cursor: 'local'}}
        onCursor={onCursor}
        onPageChange={onPageChange}
      />
    </PaginationBehaviorContextProvider>
  );
  await userEvent.click(screen.getByRole('button', {name: 'Next'}));
  expect(onCursor).toHaveBeenCalledWith('local', 1);
  expect(navigate).not.toHaveBeenCalled();
  expect(onPageChange).toHaveBeenCalledWith('local', 1);
});

it('disables navigation when neither a handler nor a behavior provider is configured', () => {
  render(<Pagination previous={{cursor: 'previous'}} next={{cursor: 'next'}} />, {
    wrapper: ThemeWrapper,
  });
  expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
});

it('renders nothing until either direction is supplied', () => {
  const {container} = render(<Pagination onCursor={jest.fn()} />, {
    wrapper: ThemeWrapper,
  });
  expect(container).toBeEmptyDOMElement();
});
