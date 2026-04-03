import {render, screen} from 'sentry-test/reactTestingLibrary';

import {slot} from './';

describe('slot', () => {
  it('returns a Provider with Slot, Outlet, and Fallback sub-components', () => {
    const SlotModule = slot(['header', 'footer'] as const);
    expect(SlotModule).toBeDefined();
    expect(SlotModule.Slot).toBeDefined();
    expect(SlotModule.Outlet).toBeDefined();
    expect(SlotModule.Fallback).toBeDefined();
  });

  it('Slot renders children in place when no Outlet is registered', () => {
    const SlotModule = slot(['header'] as const);

    render(
      <SlotModule>
        <SlotModule.Slot name="header">
          <span>inline content</span>
        </SlotModule.Slot>
      </SlotModule>
    );

    expect(screen.getByText('inline content')).toBeInTheDocument();
  });

  it('Slot portals children to the Outlet element', () => {
    const SlotModule = slot(['content'] as const);

    render(
      <SlotModule>
        <SlotModule.Outlet name="content">
          {props => <div {...props} data-test-id="slot-target" />}
        </SlotModule.Outlet>
        <SlotModule.Slot name="content">
          <span>portaled content</span>
        </SlotModule.Slot>
      </SlotModule>
    );

    expect(screen.getByTestId('slot-target')).toContainHTML(
      '<span>portaled content</span>'
    );
  });

  it('multiple Slot components render their children independently', () => {
    const SlotModule = slot(['a', 'b'] as const);

    render(
      <SlotModule>
        <SlotModule.Slot name="a">
          <span>slot a content</span>
        </SlotModule.Slot>
        <SlotModule.Slot name="b">
          <span>slot b content</span>
        </SlotModule.Slot>
      </SlotModule>
    );

    expect(screen.getByText('slot a content')).toBeInTheDocument();
    expect(screen.getByText('slot b content')).toBeInTheDocument();
  });

  it('Slot throws when rendered outside provider', () => {
    const SlotModule = slot(['nav'] as const);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SlotModule.Slot name="nav">
          <span>content</span>
        </SlotModule.Slot>
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
      <SlotModule>
        <SlotModule.Outlet name="sidebar">
          {props => <div {...props} data-test-id="sidebar-root" />}
        </SlotModule.Outlet>
      </SlotModule>
    );

    expect(screen.getByTestId('sidebar-root')).toBeInTheDocument();
  });

  it('Outlet registers and unregisters the element on mount/unmount', () => {
    const SlotModule = slot(['panel'] as const);

    const {unmount} = render(
      <SlotModule>
        <SlotModule.Outlet name="panel">
          {props => <div {...props} data-test-id="panel-root" />}
        </SlotModule.Outlet>
      </SlotModule>
    );

    expect(screen.getByTestId('panel-root')).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });

  it('provider renders its children', () => {
    const SlotModule = slot(['x'] as const);

    render(
      <SlotModule>
        <span>child content</span>
      </SlotModule>
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('separate slot() calls create independent slot systems', () => {
    const SlotModule1 = slot(['zone'] as const);
    const SlotModule2 = slot(['zone'] as const);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SlotModule1>
          <SlotModule2.Slot name="zone">
            <span>content</span>
          </SlotModule2.Slot>
        </SlotModule1>
      )
    ).toThrow('SlotContext not found');

    consoleError.mockRestore();
  });

  describe('Fallback', () => {
    it('renders children into Outlet when no Slot consumer is mounted', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule>
          <SlotModule.Outlet name="feedback">
            {props => <div {...props} data-test-id="feedback-root" />}
          </SlotModule.Outlet>
          <SlotModule.Fallback name="feedback">
            <span>default feedback</span>
          </SlotModule.Fallback>
        </SlotModule>
      );

      expect(screen.getByTestId('feedback-root')).toContainHTML(
        '<span>default feedback</span>'
      );
    });

    it('does not render when a Slot consumer is mounted', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule>
          <SlotModule.Outlet name="feedback">
            {props => <div {...props} data-test-id="feedback-root" />}
          </SlotModule.Outlet>
          <SlotModule.Fallback name="feedback">
            <span>default feedback</span>
          </SlotModule.Fallback>
          <SlotModule.Slot name="feedback">
            <span>custom feedback</span>
          </SlotModule.Slot>
        </SlotModule>
      );

      expect(screen.queryByText('default feedback')).not.toBeInTheDocument();
      expect(screen.getByTestId('feedback-root')).toContainHTML(
        '<span>custom feedback</span>'
      );
    });

    it('does not render when Outlet is not registered', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule>
          <SlotModule.Fallback name="feedback">
            <span>default feedback</span>
          </SlotModule.Fallback>
        </SlotModule>
      );

      expect(screen.queryByText('default feedback')).not.toBeInTheDocument();
    });

    it('throws when rendered outside provider', () => {
      const SlotModule = slot(['x'] as const);

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() =>
        render(
          <SlotModule.Fallback name="x">
            <span>fallback</span>
          </SlotModule.Fallback>
        )
      ).toThrow('SlotContext not found');

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
        <SlotModule>
          <TestComponent />
        </SlotModule>
      );

      rerender(
        <SlotModule>
          <TestComponent />
        </SlotModule>
      );

      expect(refs[0]).toBe(refs[refs.length - 1]);
    });
  });
});
