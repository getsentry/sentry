import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Tooltip} from '@sentry/scraps/tooltip';

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
});
