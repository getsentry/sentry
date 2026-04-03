import {render, screen} from 'sentry-test/reactTestingLibrary';

import {slot, withSlots} from './';

describe('slot', () => {
  it('returns a module with Provider, Outlet, and Fallback sub-components', () => {
    const SlotModule = slot(['header', 'footer'] as const);
    expect(SlotModule).toBeDefined();
    expect(SlotModule.Provider).toBeDefined();
    expect(SlotModule.Outlet).toBeDefined();
    expect(SlotModule.Fallback).toBeDefined();
  });

  it('renders children in place when no Outlet is registered', () => {
    const SlotModule = slot(['header'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule name="header">
          <span>inline content</span>
        </SlotModule>
      </SlotModule.Provider>
    );

    expect(screen.getByText('inline content')).toBeInTheDocument();
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

  it('multiple slot consumers render their children independently', () => {
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

    expect(screen.getByText('slot a content')).toBeInTheDocument();
    expect(screen.getByText('slot b content')).toBeInTheDocument();
  });

  it('consumer throws when rendered outside provider', () => {
    const SlotModule = slot(['nav'] as const);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SlotModule name="nav">
          <span>content</span>
        </SlotModule>
      )
    ).toThrow('SlotContext not found');

    consoleError.mockRestore();
  });

  it('Outlet throws when rendered outside provider', () => {
    const SlotModule = slot(['aside'] as const);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SlotModule.Outlet name="aside">{props => <div {...props} />}</SlotModule.Outlet>
      )
    ).toThrow('SlotContext not found');

    consoleError.mockRestore();
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

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SlotModule1.Provider>
          <SlotModule2 name="zone">
            <span>content</span>
          </SlotModule2>
        </SlotModule1.Provider>
      )
    ).toThrow('SlotContext not found');

    consoleError.mockRestore();
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

    it('throws when rendered outside provider', () => {
      const SlotModule = slot(['x'] as const);

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() =>
        render(
          <SlotModule.Fallback>
            <span>fallback</span>
          </SlotModule.Fallback>
        )
      ).toThrow('SlotContext not found');

      consoleError.mockRestore();
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
