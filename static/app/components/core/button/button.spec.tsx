import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

const theme = ThemeFixture();

function renderWithTracking(ui: React.ReactElement) {
  const tracking = jest.fn();
  function TrackingWrapper({children}: {children: React.ReactNode}) {
    return <TrackingContextProvider value={tracking}>{children}</TrackingContextProvider>;
  }

  return {tracking, ...render(ui, {additionalWrapper: TrackingWrapper})};
}

describe('Button', () => {
  it('renders', () => {
    render(<Button variant="primary">Button</Button>);
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
        </Container>
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
    render(<Button onClick={spy}>Click me</Button>);
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
      </Button>
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call `onClick` on busy buttons', async () => {
    const spy = jest.fn();
    render(
      <Button onClick={spy} busy>
        Click me
      </Button>
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('shows spinner when busy', () => {
    render(<Button busy>Busy Button</Button>);

    const button = screen.getByRole('button', {name: 'Busy Button'});
    expect(button).toHaveAttribute('aria-busy', 'true');
    const spinner = button.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });

  it('hides spinner when not busy', () => {
    render(<Button>Normal Button</Button>);

    const button = screen.getByRole('button', {name: 'Normal Button'});
    expect(button).not.toHaveAttribute('aria-busy');

    const spinner = button.querySelector('[aria-hidden="true"]');
    expect(spinner).not.toBeInTheDocument();
  });
});

describe('LinkButton', () => {
  it('tracks internal links once and calls the click handler once', async () => {
    const onClick = jest.fn();
    const {tracking} = renderWithTracking(
      <LinkButton
        to="/organizations/customer-org/issues"
        onClick={onClick}
        analyticsEventKey="link_button.clicked"
      >
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

  it('renders react-router link', () => {
    render(<LinkButton to="/some/route">Router Link</LinkButton>);
  });

  it('renders normal link', () => {
    render(<LinkButton href="/some/relative/url">Normal Link</LinkButton>);
    expect(screen.getByRole('button', {name: 'Normal Link'})).toHaveAttribute(
      'href',
      '/some/relative/url'
    );
  });

  it('renders disabled link', () => {
    render(
      <LinkButton disabled href="/some/relative/url">
        Disabled Link
      </LinkButton>
    );

    const element = screen.getByRole('button', {name: 'Disabled Link'});

    expect(element).not.toHaveAttribute('href');
    expect(element).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders external link with target="_blank" and security attributes', () => {
    render(
      <LinkButton href="https://example.com" external>
        External
      </LinkButton>
    );

    const element = screen.getByRole('button', {name: 'External'});
    expect(element).toHaveAttribute('target', '_blank');
    expect(element).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('renders internal link with target="_blank" when openInNewTab is set', () => {
    render(
      <LinkButton to="/some/route" openInNewTab>
        Open in Tab
      </LinkButton>
    );

    const element = screen.getByRole('button', {name: 'Open in Tab'});
    expect(element).toHaveAttribute('target', '_blank');
    expect(element).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('does not add target when openInNewTab is not set', () => {
    render(<LinkButton to="/some/route">Normal Route</LinkButton>);

    const element = screen.getByRole('button', {name: 'Normal Route'});
    expect(element).not.toHaveAttribute('target');
  });
});
