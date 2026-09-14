import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useDragSeparator} from '@sentry/scraps/dragHandle';

type Options = Parameters<typeof useDragSeparator>[0];

function TestSeparator(props: Partial<Options>) {
  const {cursor, separatorProps} = useDragSeparator({
    isSizedFirst: true,
    onMove: jest.fn(),
    orientation: 'horizontal',
    ...props,
  });

  return <div {...separatorProps} aria-label="Handle" data-cursor={cursor} />;
}

const separator = () => screen.getByRole('separator');

describe('useDragSeparator', () => {
  it('exposes the handle as a focusable separator', () => {
    render(<TestSeparator />);

    expect(separator()).toHaveAttribute('tabindex', '0');
  });

  it('reports the axis across which it divides when horizontal', () => {
    render(<TestSeparator orientation="horizontal" />);

    expect(separator()).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('reports the axis across which it divides when vertical', () => {
    render(<TestSeparator orientation="vertical" />);

    expect(separator()).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('announces the size against its bounds', () => {
    render(<TestSeparator max={200} min={50} value={120} />);

    // https://github.com/testing-library/jest-dom/issues/735
    // eslint-disable-next-line jest-dom/prefer-to-have-value
    expect(separator()).toHaveAttribute('aria-valuenow', '120');
    expect(separator()).toHaveAttribute('aria-valuemin', '50');
    expect(separator()).toHaveAttribute('aria-valuemax', '200');
  });

  it('omits the upper bound when the size is unbounded', () => {
    render(<TestSeparator max={Infinity} min={50} value={120} />);

    expect(separator()).not.toHaveAttribute('aria-valuemax');
  });

  it('omits the values before the size has been measured', () => {
    render(<TestSeparator />);

    expect(separator()).not.toHaveAttribute('aria-valuenow');
    expect(separator()).not.toHaveAttribute('aria-valuemin');
    expect(separator()).not.toHaveAttribute('aria-valuemax');
  });

  it('is not held before a drag starts', () => {
    render(<TestSeparator />);

    expect(separator()).toHaveAttribute('data-is-held', 'false');
  });

  it.each([
    {
      name: 'points along the axis between the bounds',
      props: {max: 200, min: 50, value: 120},
      expected: 'ew-resize',
    },
    {
      name: 'points back toward growth at the minimum',
      props: {max: 200, min: 50, value: 50},
      expected: 'e-resize',
    },
    {
      name: 'points back toward shrinking at the maximum',
      props: {max: 200, min: 50, value: 200},
      expected: 'w-resize',
    },
    {
      name: 'flips at the minimum when the sized pane is last',
      props: {isSizedFirst: false, max: 200, min: 50, value: 50},
      expected: 'w-resize',
    },
    {
      name: 'flips at the maximum when the sized pane is last',
      props: {isSizedFirst: false, max: 200, min: 50, value: 200},
      expected: 'e-resize',
    },
    {
      name: 'points along the vertical axis between the bounds',
      props: {max: 200, min: 50, orientation: 'vertical' as const, value: 120},
      expected: 'ns-resize',
    },
    {
      name: 'points back toward growth at the vertical minimum',
      props: {max: 200, min: 50, orientation: 'vertical' as const, value: 50},
      expected: 's-resize',
    },
    {
      name: 'ignores the limits until the size is measured',
      props: {min: 50},
      expected: 'ew-resize',
    },
  ])('$name', ({props, expected}) => {
    render(<TestSeparator {...props} />);

    expect(separator()).toHaveAttribute('data-cursor', expected);
  });
});
