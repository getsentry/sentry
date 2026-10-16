import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {act, render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {lightTheme} from '@sentry/scraps/theme';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

import {getEmotionRules} from '../../test/getEmotionRules';

const theme = lightTheme;

function renderWithTracking(ui: React.ReactElement) {
  const tracking = jest.fn();
  function TrackingWrapper({children}: {children: React.ReactNode}) {
    return (
      <ThemeWrapper>
        <TrackingContextProvider value={tracking}>{children}</TrackingContextProvider>
      </ThemeWrapper>
    );
  }

  return {tracking, ...render(ui, {wrapper: TrackingWrapper})};
}

describe('Button', () => {
  it('renders', () => {
    render(<Button variant="primary">Button</Button>, {wrapper: ThemeWrapper});
  });

  it('uses aria-disabled instead of disabled when a tooltip is present', async () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick} tooltipProps={{title: 'Not available'}}>
        Save
      </Button>,
      {wrapper: ThemeWrapper}
    );

    const button = screen.getByRole('button', {name: 'Save'});
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await userEvent.tab();
    expect(button).toHaveFocus();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls consumer handlers when a button with a tooltip is enabled', async () => {
    const onClick = jest.fn();
    const onKeyDown = jest.fn();
    render(
      <Button
        onClick={onClick}
        onKeyDown={onKeyDown}
        tooltipProps={{title: 'Save changes'}}
      >
        Save
      </Button>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('prevents keyboard activation when aria-disabled with tooltip', async () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick} tooltipProps={{title: 'Not available'}}>
        Save
      </Button>,
      {wrapper: ThemeWrapper}
    );

    const button = screen.getByRole('button', {name: 'Save'});
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('prevents form submission when disabled with tooltip', async () => {
    const onSubmit = jest.fn(e => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button disabled type="submit" tooltipProps={{title: 'Not available'}}>
          Submit
        </Button>
      </form>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uses native disabled when no tooltip is present', () => {
    render(<Button disabled>Save</Button>, {wrapper: ThemeWrapper});

    const button = screen.getByRole('button', {name: 'Save'});
    expect(button).toBeDisabled();
  });

  it('keeps a disabled button natively disabled when its tooltip is hidden', () => {
    render(
      <Button disabled tooltipProps={{title: 'Not available', disabled: true}}>
        Save
      </Button>,
      {wrapper: ThemeWrapper}
    );

    const button = screen.getByRole('button', {name: 'Save'});
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  describe('responsive sizing', () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    let originalResizeObserver: typeof window.ResizeObserver;

    beforeEach(() => {
      originalResizeObserver = window.ResizeObserver;
      window.ResizeObserver = class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe() {}
        unobserve() {}
        disconnect() {}
      };
      jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(0);
    });

    afterEach(() => {
      window.ResizeObserver = originalResizeObserver;
      jest.restoreAllMocks();
    });

    it('updates its size at container breakpoints', () => {
      render(
        <Container containerType="inline-size">
          <Button size={{zero: 'xs', lg: 'sm'}}>Button</Button>
        </Container>,
        {wrapper: ThemeWrapper}
      );

      const button = screen.getByRole('button', {name: 'Button'});
      expect(getEmotionRules(button).join('')).toContain(
        `height: ${theme.form.xs.height}`
      );

      act(() => {
        resizeCallback?.(
          [{contentBoxSize: [{inlineSize: 800}]} as unknown as ResizeObserverEntry],
          {} as ResizeObserver
        );
      });
      expect(getEmotionRules(button).join('')).toContain(
        `height: ${theme.form.sm.height}`
      );
    });
  });

  it('calls `onClick` callback', async () => {
    const spy = jest.fn();
    render(<Button onClick={spy}>Click me</Button>, {wrapper: ThemeWrapper});
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).toHaveBeenCalled();
  });

  it('uses the button text as the tracking label', async () => {
    const {tracking} = renderWithTracking(<Button>Save</Button>);
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(tracking).toHaveBeenCalledWith(
      expect.objectContaining({'aria-label': 'Save'})
    );
  });

  it('does not call `onClick` on disabled buttons', async () => {
    const spy = jest.fn();
    render(
      <Button onClick={spy} disabled>
        Click me
      </Button>,
      {wrapper: ThemeWrapper}
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call `onClick` on busy buttons', async () => {
    const spy = jest.fn();
    render(
      <Button onClick={spy} busy>
        Click me
      </Button>,
      {wrapper: ThemeWrapper}
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('shows spinner when busy', () => {
    render(<Button busy>Busy Button</Button>, {wrapper: ThemeWrapper});

    const button = screen.getByRole('button', {name: 'Busy Button'});
    expect(button).toHaveAttribute('aria-busy', 'true');
    // The spinner is intentionally hidden from the accessibility tree.
    // oxlint-disable-next-line testing-library/no-node-access
    const spinner = button.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });

  it('hides spinner when not busy', () => {
    render(<Button>Normal Button</Button>, {wrapper: ThemeWrapper});

    const button = screen.getByRole('button', {name: 'Normal Button'});
    expect(button).not.toHaveAttribute('aria-busy');

    // The spinner is intentionally hidden from the accessibility tree.
    // oxlint-disable-next-line testing-library/no-node-access
    const spinner = button.querySelector('[aria-hidden="true"]');
    expect(spinner).not.toBeInTheDocument();
  });
});

describe('LinkButton', () => {
  it('renders an internal destination without a router', () => {
    render(
      <LinkButton to={{pathname: '/issues/', query: {query: 'is:unresolved'}}}>
        Issues
      </LinkButton>,
      {wrapper: ThemeWrapper}
    );
    expect(screen.getByRole('button', {name: 'Issues'})).toHaveAttribute(
      'href',
      '/issues/?query=is%3Aunresolved'
    );
  });

  it('tracks internal links once and calls the click handler once without a router', async () => {
    const onClick = jest.fn(event => event.preventDefault());
    const {tracking} = renderWithTracking(
      <LinkButton to="/issues/" onClick={onClick} analyticsEventKey="link_button.clicked">
        Open
      </LinkButton>
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open'}));
    expect(tracking).toHaveBeenCalledTimes(1);
    expect(tracking).toHaveBeenCalledWith(
      expect.objectContaining({
        analyticsEventKey: 'link_button.clicked',
        analyticsParams: {},
      })
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders normal link', () => {
    render(<LinkButton href="/some/relative/url">Normal Link</LinkButton>, {
      wrapper: ThemeWrapper,
    });
    expect(screen.getByRole('button', {name: 'Normal Link'})).toHaveAttribute(
      'href',
      '/some/relative/url'
    );
  });

  it('renders disabled link', () => {
    render(
      <LinkButton disabled href="/some/relative/url">
        Disabled Link
      </LinkButton>,
      {wrapper: ThemeWrapper}
    );

    const element = screen.getByRole('button', {name: 'Disabled Link'});

    expect(element).not.toHaveAttribute('href');
    expect(element).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders external link with target="_blank" and security attributes', () => {
    render(
      <LinkButton href="https://example.com" external>
        External
      </LinkButton>,
      {wrapper: ThemeWrapper}
    );

    const element = screen.getByRole('button', {name: 'External'});
    expect(element).toHaveAttribute('target', '_blank');
    expect(element).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('renders internal link with target="_blank" when openInNewTab is set', () => {
    render(
      <LinkButton to="/some/route" openInNewTab>
        Open in Tab
      </LinkButton>,
      {wrapper: ThemeWrapper}
    );

    const element = screen.getByRole('button', {name: 'Open in Tab'});
    expect(element).toHaveAttribute('target', '_blank');
    expect(element).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('does not add target when openInNewTab is not set', () => {
    render(<LinkButton to="/some/route">Normal Route</LinkButton>, {
      wrapper: ThemeWrapper,
    });

    const element = screen.getByRole('button', {name: 'Normal Route'});
    expect(element).not.toHaveAttribute('target');
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
