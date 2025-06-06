import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {useResizableDrawer} from './useResizableDrawer';

type Direction = 'right' | 'left' | 'down' | 'up';
type Size = {height?: number; width?: number};

interface TestComponentProps {
  direction?: Direction;
  initialSize?: Size;
  max?: Size;
  min?: Size;
}

// Test component that uses the hook
function TestComponent({
  direction = 'right',
  initialSize = {width: 200},
  min = {width: 100},
  max = {width: 300},
}: TestComponentProps) {
  const {resizeHandleProps, resizedElementProps} = useResizableDrawer({
    direction,
    initialSize,
    min,
    max,
  });

  return (
    <div>
      <div data-test-id="resizable-element" {...resizedElementProps}>
        <div data-test-id="resize-handle" {...resizeHandleProps} />
      </div>
    </div>
  );
}

function mockGetBoundingClientRect(width: number, height: number) {
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation((): DOMRect => {
      return {
        width,
        height,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
      } as DOMRect;
    });
}

describe('useResizableDrawer', () => {
  beforeAll(() => {
    mockGetBoundingClientRect(200, 200);
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(1);
        return 1;
      });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((_id: number) => {
      return 1;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets initial size on render', () => {
    render(<TestComponent initialSize={{width: 250, height: 100}} />);

    const element = screen.getByTestId('resizable-element');
    expect(element).toHaveStyle({width: '250px', height: '100px'});
  });

  it('respects max value when resizing', () => {
    render(
      <TestComponent initialSize={{width: 200}} min={{width: 150}} max={{width: 300}} />
    );

    // RTL won't let us dispatch the mouseup event on the document as we are using document as the listener
    // along with disabling pointer events while dragging.
    act(() =>
      screen.getByTestId('resize-handle').dispatchEvent(
        new MouseEvent('mousedown', {
          clientX: 200,
          bubbles: true,
        })
      )
    );
    act(() => document.dispatchEvent(new MouseEvent('mousemove', {clientX: 200 + 200})));
    act(() => document.dispatchEvent(new MouseEvent('mouseup')));

    expect(screen.getByTestId('resizable-element')).toHaveStyle({width: '300px'});
  });

  it('respects min value when resizing', () => {
    render(
      <TestComponent initialSize={{width: 200}} min={{width: 100}} max={{width: 250}} />
    );

    // RTL won't let us dispatch the mouseup event on the document as we are using document as the listener
    // along with disabling pointer events while dragging.
    act(() =>
      screen.getByTestId('resize-handle').dispatchEvent(
        new MouseEvent('mousedown', {
          clientX: 200,
          bubbles: true,
        })
      )
    );
    act(() => document.dispatchEvent(new MouseEvent('mousemove', {clientX: 200 - 200})));
    act(() => document.dispatchEvent(new MouseEvent('mouseup')));

    expect(screen.getByTestId('resizable-element')).toHaveStyle({width: '100px'});
  });

  it('reacts to direction change', () => {
    const {rerender} = render(
      <TestComponent initialSize={{width: 200}} direction="right" />
    );

    rerender(
      <TestComponent
        initialSize={{width: 100}}
        direction="left"
        min={{width: 100}}
        max={{width: 250}}
      />
    );

    expect(screen.getByTestId('resizable-element')).toHaveStyle({width: '100px'});
  });
});
