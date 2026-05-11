import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SizeProvider, useSizeContext} from '@sentry/scraps/sizeContext';

import {slot, withSlots} from './';

describe('slot', () => {
  it('returns a module with Provider, Outlet, and Fallback sub-components', () => {
    const SlotModule = slot(['header', 'footer'] as const);
    expect(SlotModule).toBeDefined();
    expect(SlotModule.Provider).toBeDefined();
    expect(SlotModule.Outlet).toBeDefined();
    expect(SlotModule.Fallback).toBeDefined();
  });

  it('renders nothing when no Outlet is registered', () => {
    const SlotModule = slot(['header'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule name="header">
          <span>inline content</span>
        </SlotModule>
      </SlotModule.Provider>
    );

    expect(screen.queryByText('inline content')).not.toBeInTheDocument();
  });

  it('portals children to the Outlet element', () => {
    const SlotModule = slot(['content'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule.Outlet name="content">
          {props => <div {...props} data-test-id="slot-target" />}
        </SlotModule.Outlet>
        <SlotModule name="content">
          <span>portaled content</span>
        </SlotModule>
      </SlotModule.Provider>
    );

    expect(screen.getByTestId('slot-target')).toContainHTML(
      '<span>portaled content</span>'
    );
  });

  it('multiple slot consumers render nothing independently when no Outlet is registered', () => {
    const SlotModule = slot(['a', 'b'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule name="a">
          <span>slot a content</span>
        </SlotModule>
        <SlotModule name="b">
          <span>slot b content</span>
        </SlotModule>
      </SlotModule.Provider>
    );

    expect(screen.queryByText('slot a content')).not.toBeInTheDocument();
    expect(screen.queryByText('slot b content')).not.toBeInTheDocument();
  });

  it('consumer renders nothing when rendered outside provider', () => {
    const SlotModule = slot(['nav'] as const);

    const {container} = render(
      <SlotModule name="nav">
        <span>content</span>
      </SlotModule>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('Outlet renders children without portaling when rendered outside provider', () => {
    const SlotModule = slot(['aside'] as const);

    render(
      <SlotModule.Outlet name="aside">
        {props => <div {...props} data-test-id="outlet-child" />}
      </SlotModule.Outlet>
    );

    expect(screen.getByTestId('outlet-child')).toBeInTheDocument();
  });

  it('Outlet renders the element returned by the render prop', () => {
    const SlotModule = slot(['sidebar'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule.Outlet name="sidebar">
          {props => <div {...props} data-test-id="sidebar-root" />}
        </SlotModule.Outlet>
      </SlotModule.Provider>
    );

    expect(screen.getByTestId('sidebar-root')).toBeInTheDocument();
  });

  it('Outlet registers and unregisters the element on mount/unmount', () => {
    const SlotModule = slot(['panel'] as const);

    const {unmount} = render(
      <SlotModule.Provider>
        <SlotModule.Outlet name="panel">
          {props => <div {...props} data-test-id="panel-root" />}
        </SlotModule.Outlet>
      </SlotModule.Provider>
    );

    expect(screen.getByTestId('panel-root')).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });

  it('provider renders its children', () => {
    const SlotModule = slot(['x'] as const);

    render(
      <SlotModule.Provider>
        <span>child content</span>
      </SlotModule.Provider>
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('separate slot() calls create independent slot systems', () => {
    const SlotModule1 = slot(['zone'] as const);
    const SlotModule2 = slot(['zone'] as const);

    render(
      <SlotModule1.Provider>
        <SlotModule2 name="zone">
          <span>content</span>
        </SlotModule2>
      </SlotModule1.Provider>
    );

    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  describe('Fallback', () => {
    it('renders children into Outlet when no consumer is mounted', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule.Provider>
          <SlotModule.Outlet name="feedback">
            {props => (
              <div {...props} data-test-id="feedback-root">
                <SlotModule.Fallback>
                  <span>default feedback</span>
                </SlotModule.Fallback>
              </div>
            )}
          </SlotModule.Outlet>
        </SlotModule.Provider>
      );

      expect(screen.getByTestId('feedback-root')).toContainHTML(
        '<span>default feedback</span>'
      );
    });

    it('does not render when a consumer is mounted', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule.Provider>
          <SlotModule.Outlet name="feedback">
            {props => (
              <div {...props} data-test-id="feedback-root">
                <SlotModule.Fallback>
                  <span>default feedback</span>
                </SlotModule.Fallback>
              </div>
            )}
          </SlotModule.Outlet>
          <SlotModule name="feedback">
            <span>custom feedback</span>
          </SlotModule>
        </SlotModule.Provider>
      );

      expect(screen.queryByText('default feedback')).not.toBeInTheDocument();
      expect(screen.getByTestId('feedback-root')).toContainHTML(
        '<span>custom feedback</span>'
      );
    });

    it('renders nothing when rendered outside provider', () => {
      const SlotModule = slot(['x'] as const);

      const {container} = render(
        <SlotModule.Fallback>
          <span>fallback</span>
        </SlotModule.Fallback>
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('throws when rendered outside Outlet', () => {
      const SlotModule = slot(['x'] as const);

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() =>
        render(
          <SlotModule.Provider>
            <SlotModule.Fallback>
              <span>fallback</span>
            </SlotModule.Fallback>
          </SlotModule.Provider>
        )
      ).toThrow('Slot.Fallback must be rendered inside Slot.Outlet');

      consoleError.mockRestore();
    });
  });

  describe('Outlet ref stability', () => {
    it('ref callback passed to render prop is stable across re-renders', () => {
      const SlotModule = slot(['menu'] as const);
      const refs: Array<React.RefCallback<HTMLElement | null>> = [];

      function TestComponent() {
        return (
          <SlotModule.Outlet name="menu">
            {props => {
              refs.push(props.ref);
              return <div {...props} />;
            }}
          </SlotModule.Outlet>
        );
      }

      const {rerender} = render(
        <SlotModule.Provider>
          <TestComponent />
        </SlotModule.Provider>
      );

      rerender(
        <SlotModule.Provider>
          <TestComponent />
        </SlotModule.Provider>
      );

      expect(refs[0]).toBe(refs[refs.length - 1]);
    });
  });

  describe('context bridging', () => {
    it('bridges SizeContext from Outlet tree to portaled Consumer content', () => {
      const SlotModule = slot(['content'] as const);

      function SizeReader() {
        const size = useSizeContext();
        return <span data-test-id="size-value">{size ?? 'none'}</span>;
      }

      render(
        <SlotModule.Provider>
          <SizeProvider size="sm">
            <SlotModule.Outlet name="content">
              {props => <div {...props} data-test-id="outlet" />}
            </SlotModule.Outlet>
          </SizeProvider>
          <SlotModule name="content">
            <SizeReader />
          </SlotModule>
        </SlotModule.Provider>
      );

      expect(screen.getByTestId('size-value')).toHaveTextContent('sm');
    });

    it('bridges updated context values when they change', () => {
      const SlotModule = slot(['content'] as const);

      function SizeReader() {
        const size = useSizeContext();
        return <span data-test-id="size-value">{size ?? 'none'}</span>;
      }

      function TestApp({size}: {size: 'sm' | 'md'}) {
        return (
          <SlotModule.Provider>
            <SizeProvider size={size}>
              <SlotModule.Outlet name="content">
                {props => <div {...props} />}
              </SlotModule.Outlet>
            </SizeProvider>
            <SlotModule name="content">
              <SizeReader />
            </SlotModule>
          </SlotModule.Provider>
        );
      }

      const {rerender} = render(<TestApp size="sm" />);
      expect(screen.getByTestId('size-value')).toHaveTextContent('sm');

      rerender(<TestApp size="md" />);
      expect(screen.getByTestId('size-value')).toHaveTextContent('md');
    });

    it('bridges custom contexts registered in KNOWN_BRIDGED_CONTEXTS', () => {
      const SlotModule = slot(['content'] as const);

      function SizeReader() {
        const size = useSizeContext();
        return <span data-test-id="size-value">{size ?? 'none'}</span>;
      }

      render(
        <SlotModule.Provider>
          <SizeProvider size="xs">
            <SlotModule.Outlet name="content">
              {props => <div {...props} />}
            </SlotModule.Outlet>
          </SizeProvider>
          <SlotModule name="content">
            <SizeReader />
          </SlotModule>
        </SlotModule.Provider>
      );

      expect(screen.getByTestId('size-value')).toHaveTextContent('xs');
    });

    it('does not provide bridged context when no provider wraps the Outlet', () => {
      const SlotModule = slot(['content'] as const);

      function SizeReader() {
        const size = useSizeContext();
        return <span data-test-id="size-value">{size ?? 'none'}</span>;
      }

      render(
        <SlotModule.Provider>
          <SlotModule.Outlet name="content">
            {props => <div {...props} />}
          </SlotModule.Outlet>
          <SlotModule name="content">
            <SizeReader />
          </SlotModule>
        </SlotModule.Provider>
      );

      expect(screen.getByTestId('size-value')).toHaveTextContent('none');
    });
  });

  describe('withSlots', () => {
    it('attaches a Slot property to a component', () => {
      const SlotModule = slot(['header'] as const);

      function MyComponent() {
        return <div data-test-id="my-component" />;
      }

      const WithSlots = withSlots(MyComponent, SlotModule);

      expect(WithSlots.Slot).toBe(SlotModule);
    });

    it('renders the wrapped component and allows slot injection', () => {
      const SlotModule = slot(['title'] as const);

      function MyComponent() {
        return (
          <div data-test-id="my-component">
            <SlotModule.Outlet name="title">
              {props => <span {...props} data-test-id="title-outlet" />}
            </SlotModule.Outlet>
          </div>
        );
      }

      const WithSlots = withSlots(MyComponent, SlotModule);

      render(
        <WithSlots.Slot.Provider>
          <WithSlots />
          <WithSlots.Slot name="title">
            <span>injected title</span>
          </WithSlots.Slot>
        </WithSlots.Slot.Provider>
      );

      expect(screen.getByTestId('title-outlet')).toContainHTML(
        '<span>injected title</span>'
      );
    });
  });
});
