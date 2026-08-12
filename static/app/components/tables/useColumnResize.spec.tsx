import {useRef} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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
  const {onResizeMouseDown} = useColumnResize({
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
            <div data-test-id="resizer" onMouseDown={e => onResizeMouseDown(e, 0)} />
            {/* Mirrors the onContextMenu wiring, where no column index is passed. */}
            <div data-test-id="no-index-handle" onMouseDown={onResizeMouseDown} />
          </th>
        </tr>
      </thead>
    </table>
  );
}

// Columns start at 0px in jsdom (offsetWidth is unavailable), so the resulting width
// equals the horizontal drag distance. The whole gesture runs in one pointer() call
// so the held-button state stays coherent across steps.
function drag(
  from: number,
  {to, release, target = 'resizer'}: {release?: number; target?: string; to?: number} = {}
) {
  const steps: Parameters<typeof userEvent.pointer>[0] = [
    {keys: '[MouseLeft>]', target: screen.getByTestId(target), coords: {clientX: from}},
  ];
  if (to !== undefined) {
    steps.push({coords: {clientX: to}});
  }
  if (release !== undefined) {
    steps.push({keys: '[/MouseLeft]', coords: {clientX: release}});
  }
  return userEvent.pointer(steps);
}

describe('useColumnResize', () => {
  it('computes the new width from the drag distance', async () => {
    const getResizeTemplate = jest.fn(() => '60px');
    render(<TestTable getResizeTemplate={getResizeTemplate} />);

    await drag(100, {to: 160, release: 160});

    // Writes are batched into an animation frame.
    await waitFor(() => expect(getResizeTemplate).toHaveBeenCalledWith(0, 60));
  });

  it('commits the final width when the drag ends', async () => {
    const onColumnResizeEnd = jest.fn();
    render(<TestTable onColumnResizeEnd={onColumnResizeEnd} />);

    await drag(100, {release: 250});

    expect(onColumnResizeEnd).toHaveBeenCalledWith(0, 150);
  });

  it('stops resizing when the drag has ended', async () => {
    const getResizeTemplate = jest.fn(() => '40px');
    render(<TestTable getResizeTemplate={getResizeTemplate} />);

    await drag(100, {to: 140, release: 140});
    await waitFor(() => expect(getResizeTemplate).toHaveBeenCalled());
    getResizeTemplate.mockClear();
    await userEvent.pointer({
      target: screen.getByTestId('resizer'),
      coords: {clientX: 999},
    });

    expect(getResizeTemplate).not.toHaveBeenCalled();
  });

  it('does not start a resize without a column index', async () => {
    const getResizeTemplate = jest.fn(() => '10px');
    const onColumnResizeEnd = jest.fn();
    render(
      <TestTable
        getResizeTemplate={getResizeTemplate}
        onColumnResizeEnd={onColumnResizeEnd}
      />
    );

    await drag(100, {to: 200, release: 200, target: 'no-index-handle'});

    expect(getResizeTemplate).not.toHaveBeenCalled();
    expect(onColumnResizeEnd).not.toHaveBeenCalled();
  });

  it('sets the resizer-height CSS variable when writeResizerHeightVar is enabled', async () => {
    render(<TestTable writeResizerHeightVar />);

    await drag(100, {to: 150, release: 150});

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

    await drag(100, {to: 150, release: 150});
    await waitFor(() => expect(getResizeTemplate).toHaveBeenCalled());

    expect(
      screen.getByTestId('grid').style.getPropertyValue('--grid-editable-resizer-height')
    ).toBe('');
  });

  it('tears down a previous drag when a new one starts without a mouseup', async () => {
    const getResizeTemplate = jest.fn(() => '10px');
    render(<TestTable getResizeTemplate={getResizeTemplate} />);
    const resizer = screen.getByTestId('resizer');

    // A missed mouseup (e.g. the pointer was released outside the window) leaves the
    // first drag's listeners attached; starting a second drag must remove them so a
    // single move can't fire two handlers. userEvent cannot model a missed mouseup, so
    // dispatch the events directly.
    resizer.dispatchEvent(
      new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: 100})
    );
    resizer.dispatchEvent(
      new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: 100})
    );
    getResizeTemplate.mockClear();
    window.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 160}));

    await waitFor(() => expect(getResizeTemplate).toHaveBeenCalled());
    expect(getResizeTemplate).toHaveBeenCalledTimes(1);
  });
});
