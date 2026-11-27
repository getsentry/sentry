import {useObjectRef} from '@react-aria/utils';
import {act, render, screen} from '@testing-library/react';

import {useDimensions} from '@sentry/scraps/useDimensions';

import {
  MockResizeObserver,
  resetResizeObservers,
  triggerResizeObservers,
} from '../test/resizeObserver';

function Measured({attached = true}: {attached?: boolean}) {
  const {ref, height, width} = useDimensions();
  return (
    <div>
      <p>{`${width}x${height}`}</p>
      {attached && <div ref={ref} />}
    </div>
  );
}

function MeasuredObjectRef({attached = true}: {attached?: boolean}) {
  const {ref, height, width} = useDimensions();
  const objectRef = useObjectRef<HTMLDivElement>(ref);
  return (
    <div>
      <p>{`${width}x${height}`}</p>
      {attached && <div ref={objectRef} />}
    </div>
  );
}

describe('useDimensions', () => {
  const OriginalResizeObserver = globalThis.ResizeObserver;
  // jsdom elements are zero-sized
  let size = {height: 20, width: 100};

  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver;
    size = {height: 20, width: 100};
    Object.defineProperties(HTMLDivElement.prototype, {
      clientHeight: {configurable: true, get: () => size.height},
      clientWidth: {configurable: true, get: () => size.width},
    });
  });

  afterEach(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
    resetResizeObservers();
    Reflect.deleteProperty(HTMLDivElement.prototype, 'clientHeight');
    Reflect.deleteProperty(HTMLDivElement.prototype, 'clientWidth');
  });

  it('measures the element when it mounts', () => {
    render(<Measured />);

    expect(screen.getByText('100x20')).toBeInTheDocument();
  });

  it('measures the element again when it resizes', () => {
    render(<Measured />);

    size = {height: 40, width: 300};
    act(triggerResizeObservers);

    expect(screen.getByText('300x40')).toBeInTheDocument();
  });

  it('resets to 0 and stops observing when the element detaches', () => {
    const {rerender} = render(<Measured />);

    rerender(<Measured attached={false} />);
    expect(screen.getByText('0x0')).toBeInTheDocument();

    size = {height: 40, width: 300};
    act(triggerResizeObservers);
    expect(screen.getByText('0x0')).toBeInTheDocument();
  });

  it('resets to 0 when attached through an object ref', () => {
    const {rerender} = render(<MeasuredObjectRef />);
    expect(screen.getByText('100x20')).toBeInTheDocument();

    rerender(<MeasuredObjectRef attached={false} />);
    expect(screen.getByText('0x0')).toBeInTheDocument();

    size = {height: 40, width: 300};
    act(triggerResizeObservers);
    expect(screen.getByText('0x0')).toBeInTheDocument();
  });
});
