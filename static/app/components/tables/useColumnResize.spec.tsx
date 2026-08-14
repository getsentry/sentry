import {useRef} from 'react';

import {dragHandle} from 'sentry-test/dragMove';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {triggerResizeObservers} from 'sentry-test/resizeObserver';

import {useDragMove} from '@sentry/scraps/dragHandle';

import {useColumnResize} from 'sentry/components/tables/useColumnResize';
import {useObservedColumnSize} from 'sentry/components/tables/useObservedColumnSize';

interface HandleProps {
  columnIndex: number;
  onResizeEnd: () => void;
  onResizeMove: (delta: number) => void;
  onResizeStart: (columnIndex: number, cell: HTMLElement | null) => void;
}

// Stands in for whatever a shell renders on the column edge.
function Handle({columnIndex, onResizeEnd, onResizeMove, onResizeStart}: HandleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {max, width} = useObservedColumnSize(ref);
  const {moveProps} = useDragMove({
    onMove: onResizeMove,
    onMoveEnd: onResizeEnd,
    onMoveStart: () => onResizeStart(columnIndex, ref.current?.closest('th') ?? null),
    orientation: 'horizontal',
  });

  return (
    <div
      {...moveProps}
      aria-valuemax={max || undefined}
      aria-valuenow={width || undefined}
      ref={ref}
      role="separator"
      tabIndex={0}
    />
  );
}

interface TestTableProps {
  getResizeTemplate?: (columnIndex: number, newWidth: number) => string;
  onColumnResizeEnd?: (columnIndex: number, newWidth: number) => void;
}

function TestTable({
  getResizeTemplate = (_index, newWidth) => `${Math.round(newWidth)}px`,
  onColumnResizeEnd,
}: TestTableProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  const {onResizeEnd, onResizeMove, onResizeStart} = useColumnResize({
    gridRef,
    getResizeTemplate,
    onColumnResizeEnd,
  });

  return (
    <table ref={gridRef} data-test-id="grid">
      <thead>
        <tr>
          <th>
            <div>Column</div>
            <Handle
              columnIndex={0}
              onResizeEnd={onResizeEnd}
              onResizeMove={onResizeMove}
              onResizeStart={onResizeStart}
            />
          </th>
        </tr>
      </thead>
    </table>
  );
}

// Columns start at 0px in jsdom (offsetWidth is unavailable), so the resulting width
// equals the horizontal drag distance.
const resizer = () => screen.getByRole('separator');

describe('useColumnResize', () => {
  it('computes the new width from the drag distance', async () => {
    const getResizeTemplate = jest.fn(() => '60px');
    render(<TestTable getResizeTemplate={getResizeTemplate} />);

    dragHandle(resizer(), {from: 100, to: 160});

    // Writes are batched into an animation frame.
    await waitFor(() => expect(getResizeTemplate).toHaveBeenCalledWith(0, 60));
  });

  it('commits the final width when the drag ends', () => {
    const onColumnResizeEnd = jest.fn();
    render(<TestTable onColumnResizeEnd={onColumnResizeEnd} />);

    dragHandle(resizer(), {from: 100, to: 250});

    expect(onColumnResizeEnd).toHaveBeenCalledWith(0, 150);
  });

  it('stops resizing when the drag has ended', async () => {
    const getResizeTemplate = jest.fn(() => '40px');
    render(<TestTable getResizeTemplate={getResizeTemplate} />);

    dragHandle(resizer(), {from: 100, to: 140});
    await waitFor(() => expect(getResizeTemplate).toHaveBeenCalled());
    getResizeTemplate.mockClear();
    dragHandle(resizer(), {button: 1, from: 140, to: 999});

    expect(getResizeTemplate).not.toHaveBeenCalled();
  });

  it('does not start a resize from a non-primary button', () => {
    const onColumnResizeEnd = jest.fn();
    render(<TestTable onColumnResizeEnd={onColumnResizeEnd} />);

    dragHandle(resizer(), {button: 2, from: 100, to: 200});

    expect(onColumnResizeEnd).not.toHaveBeenCalled();
  });

  it.each([
    {name: 'grows the column when arrowed right', keys: '{ArrowRight}', expected: 10},
    {name: 'shrinks the column when arrowed left', keys: '{ArrowLeft}', expected: -10},
    {
      name: 'takes a larger step when shift is held',
      keys: '{Shift>}{ArrowRight}{/Shift}',
      expected: 50,
    },
  ])('$name', async ({keys, expected}) => {
    const onColumnResizeEnd = jest.fn();
    render(<TestTable onColumnResizeEnd={onColumnResizeEnd} />);

    await userEvent.tab();
    await userEvent.keyboard(keys);

    expect(onColumnResizeEnd).toHaveBeenCalledWith(0, expected);
  });

  it('does not resize when a key other than an arrow is pressed', async () => {
    const onColumnResizeEnd = jest.fn();
    render(<TestTable onColumnResizeEnd={onColumnResizeEnd} />);

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(onColumnResizeEnd).not.toHaveBeenCalled();
  });

  it('does not commit a width when arrowed across the resize axis', async () => {
    const onColumnResizeEnd = jest.fn();
    render(<TestTable onColumnResizeEnd={onColumnResizeEnd} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');

    expect(onColumnResizeEnd).not.toHaveBeenCalled();
  });

  it('does not commit a width when the drag never travelled along the axis', () => {
    const onColumnResizeEnd = jest.fn();
    render(<TestTable onColumnResizeEnd={onColumnResizeEnd} />);

    dragHandle(resizer(), {from: 100, to: 100, y: 60});

    expect(onColumnResizeEnd).not.toHaveBeenCalled();
  });

  // jsdom reports every element as zero-sized, so the geometry the resizer observes
  // has to be stubbed before the observers are triggered by hand.
  function stubGeometry({cell, table}: {cell: number; table: number}) {
    Object.defineProperty(screen.getByRole('columnheader'), 'offsetWidth', {
      configurable: true,
      get: () => cell,
    });
    const grid = screen.getByTestId('grid');
    Object.defineProperty(grid, 'clientWidth', {configurable: true, get: () => table});
    Object.defineProperty(grid, 'offsetHeight', {configurable: true, get: () => 240});
  }

  it('publishes the table height to the handle as a CSS variable', () => {
    render(<TestTable />);
    stubGeometry({cell: 150, table: 900});

    act(triggerResizeObservers);

    expect(resizer().style.getPropertyValue('--column-resizer-height')).toBe('240px');
  });

  it('announces the observed column width against the table width', () => {
    render(<TestTable />);
    stubGeometry({cell: 150, table: 900});

    act(triggerResizeObservers);

    // https://github.com/testing-library/jest-dom/issues/735
    // eslint-disable-next-line jest-dom/prefer-to-have-value
    expect(resizer()).toHaveAttribute('aria-valuenow', '150');
  });

  it('announces the table width as the upper bound', () => {
    render(<TestTable />);
    stubGeometry({cell: 150, table: 900});

    act(triggerResizeObservers);

    expect(resizer()).toHaveAttribute('aria-valuemax', '900');
  });
});
