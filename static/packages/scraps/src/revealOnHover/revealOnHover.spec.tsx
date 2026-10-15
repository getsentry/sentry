import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {RevealOnHover} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('RevealOnHover', () => {
  it('renders children and action', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <button>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
  });

  it('wraps action children with a data-reveal-on-hover element', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <button>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    const button = screen.getByRole('button', {name: 'Copy'});
    // eslint-disable-next-line testing-library/no-node-access -- The CSS reveal marker is on the action's wrapper.
    expect(button.closest('[data-reveal-on-hover]')).toBeInTheDocument();
  });

  it('marks the action as visible when visible is true', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action visible>
          <button>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    const button = screen.getByRole('button', {name: 'Copy'});
    // eslint-disable-next-line testing-library/no-node-access -- The CSS reveal marker is on the action's wrapper.
    expect(button.closest('[data-reveal-on-hover]')).toHaveAttribute(
      'data-reveal-on-hover-visible',
      ''
    );
  });

  it('keeps the action mounted when visibility changes', () => {
    const {rerender} = render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <button>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    const button = screen.getByRole('button', {name: 'Copy'});

    rerender(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action visible>
          <button>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>
    );

    expect(screen.getByRole('button', {name: 'Copy'})).toBe(button);
  });

  it('passes through Flex props to the root element', () => {
    render(
      <RevealOnHover data-test-id="hover-root" gap="md" justify="between">
        <span>Label</span>
        <RevealOnHover.Action>
          <button>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByTestId('hover-root')).toBeInTheDocument();
  });

  it('action button is clickable', async () => {
    const onClick = jest.fn();

    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <button onClick={onClick}>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports multiple actions', () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <button>Copy</button>
        </RevealOnHover.Action>
        <RevealOnHover.Action>
          <button aria-label="Delete">Delete</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    const copyButton = screen.getByRole('button', {name: 'Copy'});
    const deleteButton = screen.getByRole('button', {name: 'Delete'});
    // eslint-disable-next-line testing-library/no-node-access -- The CSS reveal marker is on the action's wrapper.
    expect(copyButton.closest('[data-reveal-on-hover]')).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access -- The CSS reveal marker is on the action's wrapper.
    expect(deleteButton.closest('[data-reveal-on-hover]')).toBeInTheDocument();
  });

  it('action button is focusable via keyboard', async () => {
    render(
      <RevealOnHover>
        <span>Label</span>
        <RevealOnHover.Action>
          <button>Copy</button>
        </RevealOnHover.Action>
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Copy'})).toHaveFocus();
  });

  it('supports callback children for custom elements', () => {
    render(
      <RevealOnHover>
        {props => (
          <div data-test-id="custom-root" {...props}>
            <span>Grid content</span>
            <RevealOnHover.Action>
              <button>Copy</button>
            </RevealOnHover.Action>
          </div>
        )}
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByTestId('custom-root')).toBeInTheDocument();
    expect(screen.getByText('Grid content')).toBeInTheDocument();
    const button = screen.getByRole('button', {name: 'Copy'});
    // eslint-disable-next-line testing-library/no-node-access -- The CSS reveal marker is on the action's wrapper.
    expect(button.closest('[data-reveal-on-hover]')).toBeInTheDocument();
  });

  it('callback children action button is clickable', async () => {
    const onClick = jest.fn();

    render(
      <RevealOnHover>
        {props => (
          <div {...props}>
            <span>Content</span>
            <RevealOnHover.Action>
              <button onClick={onClick}>Copy</button>
            </RevealOnHover.Action>
          </div>
        )}
      </RevealOnHover>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
