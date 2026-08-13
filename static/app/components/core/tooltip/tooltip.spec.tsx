import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Container} from '@sentry/scraps/layout';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

describe('Tooltip', () => {
  let originalResizeObserver: typeof window.ResizeObserver;

  function mockOverflow(width: number, containerWidth: number) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: containerWidth,
    });
  }

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.clientWidth;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    originalResizeObserver = window.ResizeObserver;
  });

  it('renders', async () => {
    render(
      <Tooltip title="test">
        <button>My Button</button>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('test')).toBeInTheDocument();

    // Check that the arrow svg is rendered
    expect(document.querySelector('svg')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
    await waitFor(() => {
      expect(screen.queryByText('test')).not.toBeInTheDocument();
    });
  });

  it('updates title', async () => {
    const {rerender} = render(
      <Tooltip title="test">
        <button>My Button</button>
      </Tooltip>
    );

    // Change title
    rerender(
      <Tooltip title="bar">
        <button>My Button</button>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('bar')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
    await waitFor(() => {
      expect(screen.queryByText('bar')).not.toBeInTheDocument();
    });
  });

  it('disables and does not render', async () => {
    render(
      <Tooltip title="test" disabled>
        <button>My Button</button>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
  });

  it('resets visibility when becoming disabled', async () => {
    const {rerender} = render(
      <Tooltip title="test" disabled={false}>
        <button>My Button</button>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('test')).toBeInTheDocument();

    rerender(
      <Tooltip title="test" disabled>
        <button>My Button</button>
      </Tooltip>
    );
    expect(screen.queryByText('test')).not.toBeInTheDocument();

    // Becomes enabled again
    rerender(
      <Tooltip title="test" disabled={false}>
        <button>My Button</button>
      </Tooltip>
    );
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('does not render an empty tooltip', async () => {
    render(
      <Tooltip title="">
        <button>My Button</button>
      </Tooltip>
    );
    await userEvent.hover(screen.getByText('My Button'));

    expect(screen.getByText('My Button')).not.toHaveAttribute('aria-describedby');

    await userEvent.unhover(screen.getByText('My Button'));
  });

  it('displays a tooltip if the content overflows with showOnlyOnOverflow', async () => {
    // Mock this to return true because scrollWidth and clientWidth are 0 in JSDOM
    mockOverflow(100, 50);

    render(
      <Tooltip title="test" showOnlyOnOverflow>
        <div>This text overflows</div>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('This text overflows'));

    expect(screen.getByText('test')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('This text overflows'));
  });

  it('hides an open tooltip when the content stops overflowing', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    mockOverflow(100, 50);
    render(
      <Tooltip title="test" showOnlyOnOverflow>
        <div>This text changes size</div>
      </Tooltip>
    );

    const trigger = screen.getByText('This text changes size');
    await userEvent.hover(trigger);
    expect(screen.getByText('test')).toBeInTheDocument();

    mockOverflow(50, 100);
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(screen.queryByText('test')).not.toBeInTheDocument();
    });
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it('does not display a tooltip if the content does not overflow with showOnlyOnOverflow', async () => {
    mockOverflow(50, 100);

    render(
      <Tooltip title="test" showOnlyOnOverflow>
        <div>This text does not overflow</div>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('This text does not overflow'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('does not trigger the wrapping element when clicking tooltip content', async () => {
    const handleAncestorClick = jest.fn();

    render(
      <button type="button" onClick={handleAncestorClick}>
        <Tooltip title={<span>Copy</span>} isHoverable forceVisible>
          <div>Trigger</div>
        </Tooltip>
      </button>
    );

    await userEvent.click(screen.getByText('Copy'));
    expect(handleAncestorClick).not.toHaveBeenCalled();
  });

  describe('content padding', () => {
    // This suite stubs `getComputedStyle` so that it cannot see emotion rules
    // (tests/js/setup.ts), which rules out asserting padding directly — and
    // makes a negative style assertion pass vacuously. Emotion derives the
    // class name from a hash of the serialized styles, so comparing classes
    // between two renders is a real assertion about the CSS they produce.
    async function paddingClassName(padding?: TooltipProps['padding']) {
      const {unmount} = render(
        <Tooltip title="test" padding={padding}>
          <button>My Button</button>
        </Tooltip>
      );
      await userEvent.hover(screen.getByText('My Button'));
      const className = screen.getByText('test').closest('[data-tooltip]')?.className;
      unmount();

      return className;
    }

    it('pads the content by default', async () => {
      const byDefault = await paddingClassName();

      // Every tooltip that has not opted out depends on this default, so it is
      // the regression guard for the existing call sites.
      expect(byDefault).toBeTruthy();
      expect(byDefault).toBe(await paddingClassName('md lg'));
    });

    it('drops the content padding when opted out', async () => {
      expect(await paddingClassName('0')).not.toBe(await paddingClassName());
    });
  });

  describe('sections', () => {
    it('renders a header label alongside its trailing value', async () => {
      render(
        <Tooltip
          padding="0"
          title={<Tooltip.Header trailing="8mo ago">Last Seen</Tooltip.Header>}
        >
          <button>My Button</button>
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(screen.getByText('Last Seen')).toBeInTheDocument();
      expect(screen.getByText('8mo ago')).toBeInTheDocument();
    });

    it('renders a footer label alongside its trailing value', async () => {
      render(
        <Tooltip
          padding="0"
          title={<Tooltip.Footer trailing="UTC">Times shown in</Tooltip.Footer>}
        >
          <button>My Button</button>
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(screen.getByText('Times shown in')).toBeInTheDocument();
      expect(screen.getByText('UTC')).toBeInTheDocument();
    });

    it('renders every row into the one body grid', async () => {
      render(
        <Tooltip
          padding="0"
          title={
            <Tooltip.Body columns="max-content 1fr">
              <Tooltip.Row>
                <span>PDT</span>
                <span>Jul 28, 2026</span>
              </Tooltip.Row>
              <Tooltip.Row>
                <span>UTC</span>
                <span>Jul 29, 2026</span>
              </Tooltip.Row>
            </Tooltip.Body>
          }
        >
          <button>My Button</button>
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      // Sharing one grid is what keeps a column aligned between the rows when
      // one row's cell is wider than the other's.
      const firstRow = screen.getByText('PDT').parentElement;
      const secondRow = screen.getByText('UTC').parentElement;

      expect(firstRow).toBeInTheDocument();
      expect(firstRow?.parentElement).toBe(secondRow?.parentElement);
    });

    it('renders a row as a layout-less wrapper so its cells join that grid', async () => {
      // A row that established its own layout box would align its columns only
      // against itself, so what it renders has to stay `display: contents`.
      // Same class as the reference means the same serialized styles.
      const reference = render(
        <Container display="contents">
          <span>reference cell</span>
        </Container>
      );
      const referenceClassName =
        screen.getByText('reference cell').parentElement?.className;
      reference.unmount();

      render(
        <Tooltip
          padding="0"
          title={
            <Tooltip.Body>
              <Tooltip.Row>
                <span>row cell</span>
              </Tooltip.Row>
            </Tooltip.Body>
          }
        >
          <button>My Button</button>
        </Tooltip>
      );

      await userEvent.hover(screen.getByText('My Button'));

      expect(referenceClassName).toBeTruthy();
      expect(screen.getByText('row cell').parentElement?.className).toBe(
        referenceClassName
      );
    });
  });
});
