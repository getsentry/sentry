import {useRef} from 'react';

import {dragHandle} from 'sentry-test/dragMove';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ColumnResizer} from 'sentry/components/tables/columnResizer';
import {useColumnResize} from 'sentry/components/tables/useColumnResize';

interface TestTableProps {
  getResizeTemplate?: (columnIndex: number, newWidth: number) => string;
  onColumnResizeEnd?: (columnIndex: number, newWidth: number) => void;
  writeResizerHeightVar?: boolean;
}

function TestTable({
  getResizeTemplate = (_index, newWidth) => `${Math.round(newWidth)}px`,
  onColumnResizeEnd,
  writeResizerHeightVar,
}: TestTableProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  const {onResizeEnd, onResizeMove, onResizeStart} = useColumnResize({
    gridRef,
    getResizeTemplate,
    onColumnResizeEnd,
    writeResizerHeightVar,
  });

  return (
    <table ref={gridRef} data-test-id="grid">
      <thead>
        <tr>
          <th>
            <div>Column</div>
            <ColumnResizer
              columnIndex={0}
              dataRows={0}
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

  it('commits the final width when the drag ends', async () => {
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

  it('does not start a resize from a non-primary button', async () => {
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

  it('sets the resizer-height CSS variable when writeResizerHeightVar is enabled', async () => {
    render(<TestTable writeResizerHeightVar />);

    dragHandle(resizer(), {from: 100, to: 150});

    await waitFor(() =>
      expect(
        screen
          .getByTestId('grid')
          .style.getPropertyValue('--grid-editable-resizer-height')
      ).toBe('0px')
    );
  });

  it('does not set the resizer-height CSS variable by default', async () => {
    const getResizeTemplate = jest.fn(() => '50px');
    render(<TestTable getResizeTemplate={getResizeTemplate} />);

    dragHandle(resizer(), {from: 100, to: 150});
    await waitFor(() => expect(getResizeTemplate).toHaveBeenCalled());

    expect(
      screen.getByTestId('grid').style.getPropertyValue('--grid-editable-resizer-height')
    ).toBe('');
  });
});
