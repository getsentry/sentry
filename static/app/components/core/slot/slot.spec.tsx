import {render, screen} from 'sentry-test/reactTestingLibrary';

import {slot} from './';

describe('slot', () => {
  it('returns a Provider and slot components with Root and Fallback sub-components', () => {
    const SlotModule = slot(['header', 'footer'] as const);
    expect(SlotModule.Provider).toBeDefined();
    expect(SlotModule.slot.header).toBeDefined();
    expect(SlotModule.slot.footer).toBeDefined();
    expect(SlotModule.slot.header.Root).toBeDefined();
    expect(SlotModule.slot.footer.Root).toBeDefined();
    expect(SlotModule.slot.header.Fallback).toBeDefined();
    expect(SlotModule.slot.footer.Fallback).toBeDefined();
  });

  it('slot component renders children in place when no Root is registered', () => {
    const SlotModule = slot(['header'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule.slot.header>
          <span>inline content</span>
        </SlotModule.slot.header>
      </SlotModule.Provider>
    );

    expect(screen.getByText('inline content')).toBeInTheDocument();
  });

  it('slot component portals children to the Root element', () => {
    const SlotModule = slot(['content'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule.slot.content.Root>
          {props => <div {...props} data-test-id="slot-target" />}
        </SlotModule.slot.content.Root>
        <SlotModule.slot.content>
          <span>portaled content</span>
        </SlotModule.slot.content>
      </SlotModule.Provider>
    );

    expect(screen.getByTestId('slot-target')).toContainHTML(
      '<span>portaled content</span>'
    );
  });

  it('multiple slot components render their children independently', () => {
    const SlotModule = slot(['a', 'b'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule.slot.a>
          <span>slot a content</span>
        </SlotModule.slot.a>
        <SlotModule.slot.b>
          <span>slot b content</span>
        </SlotModule.slot.b>
      </SlotModule.Provider>
    );

    expect(screen.getByText('slot a content')).toBeInTheDocument();
    expect(screen.getByText('slot b content')).toBeInTheDocument();
  });

  it('slot component throws when rendered outside provider', () => {
    const SlotModule = slot(['nav'] as const);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SlotModule.slot.nav>
          <span>content</span>
        </SlotModule.slot.nav>
      )
    ).toThrow('SlotContext not found');

    consoleError.mockRestore();
  });

  it('Root throws when rendered outside provider', () => {
    const SlotModule = slot(['aside'] as const);

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <SlotModule.slot.aside.Root>
          {props => <div {...props} />}
        </SlotModule.slot.aside.Root>
      )
    ).toThrow('SlotContext not found');

    consoleError.mockRestore();
  });

  it('Root renders the element returned by the render prop', () => {
    const SlotModule = slot(['sidebar'] as const);

    render(
      <SlotModule.Provider>
        <SlotModule.slot.sidebar.Root>
          {props => <div {...props} data-test-id="sidebar-root" />}
        </SlotModule.slot.sidebar.Root>
      </SlotModule.Provider>
    );

    expect(screen.getByTestId('sidebar-root')).toBeInTheDocument();
  });

  it('Root registers and unregisters the element on mount/unmount', () => {
    const SlotModule = slot(['panel'] as const);

    const {unmount} = render(
      <SlotModule.Provider>
        <SlotModule.slot.panel.Root>
          {props => <div {...props} data-test-id="panel-root" />}
        </SlotModule.slot.panel.Root>
      </SlotModule.Provider>
    );

    expect(screen.getByTestId('panel-root')).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });

  it('slot component has the correct display name', () => {
    const SlotModule = slot(['toolbar'] as const);
    expect(SlotModule.slot.toolbar.displayName).toBe('Slot.(toolbar)');
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
          <SlotModule2.slot.zone>
            <span>content</span>
          </SlotModule2.slot.zone>
        </SlotModule1.Provider>
      )
    ).toThrow('SlotContext not found');

    consoleError.mockRestore();
  });

  describe('Fallback', () => {
    it('renders children into Root when no slot consumer is mounted', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule.Provider>
          <SlotModule.slot.feedback.Root>
            {props => <div {...props} data-test-id="feedback-root" />}
          </SlotModule.slot.feedback.Root>
          <SlotModule.slot.feedback.Fallback>
            <span>default feedback</span>
          </SlotModule.slot.feedback.Fallback>
        </SlotModule.Provider>
      );

      expect(screen.getByTestId('feedback-root')).toContainHTML(
        '<span>default feedback</span>'
      );
    });

    it('does not render when a slot consumer is mounted', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule.Provider>
          <SlotModule.slot.feedback.Root>
            {props => <div {...props} data-test-id="feedback-root" />}
          </SlotModule.slot.feedback.Root>
          <SlotModule.slot.feedback.Fallback>
            <span>default feedback</span>
          </SlotModule.slot.feedback.Fallback>
          <SlotModule.slot.feedback>
            <span>custom feedback</span>
          </SlotModule.slot.feedback>
        </SlotModule.Provider>
      );

      expect(screen.queryByText('default feedback')).not.toBeInTheDocument();
      expect(screen.getByTestId('feedback-root')).toContainHTML(
        '<span>custom feedback</span>'
      );
    });

    it('does not render when Root is not registered', () => {
      const SlotModule = slot(['feedback'] as const);

      render(
        <SlotModule.Provider>
          <SlotModule.slot.feedback.Fallback>
            <span>default feedback</span>
          </SlotModule.slot.feedback.Fallback>
        </SlotModule.Provider>
      );

      expect(screen.queryByText('default feedback')).not.toBeInTheDocument();
    });

    it('throws when rendered outside provider', () => {
      const SlotModule = slot(['x'] as const);

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() =>
        render(
          <SlotModule.slot.x.Fallback>
            <span>fallback</span>
          </SlotModule.slot.x.Fallback>
        )
      ).toThrow('SlotContext not found');

      consoleError.mockRestore();
    });
  });

  describe('Root ref stability', () => {
    it('ref callback passed to render prop is stable across re-renders', () => {
      const SlotModule = slot(['menu'] as const);
      const refs: Array<React.RefCallback<HTMLElement | null>> = [];

      function TestComponent() {
        return (
          <SlotModule.slot.menu.Root>
            {props => {
              refs.push(props.ref);
              return <div {...props} />;
            }}
          </SlotModule.slot.menu.Root>
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
});
