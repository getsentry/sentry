import {makeFlamegraph} from 'sentry-test/profiling/utils';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {FlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/flamegraphDrawer/flamegraphTreeTable';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';

const flamegraph = makeFlamegraph(
  {
    endValue: 10,
    events: [
      {type: 'O', at: 0, frame: 0},
      {type: 'O', at: 1, frame: 1},
      {type: 'O', at: 2, frame: 2},
      {type: 'C', at: 4, frame: 2},
      {type: 'C', at: 6, frame: 1},
      {type: 'O', at: 6, frame: 3},
      {type: 'C', at: 8, frame: 3},
      {type: 'C', at: 10, frame: 0},
    ],
  },
  [{name: 'root'}, {name: 'parent'}, {name: 'child'}, {name: 'another'}]
);

function renderTreeTable() {
  const canvasPoolManager = new CanvasPoolManager();
  const canvasScheduler = new CanvasScheduler();

  render(
    <FlamegraphTreeTable
      canvasPoolManager={canvasPoolManager}
      canvasScheduler={canvasScheduler}
      flamegraph={flamegraph}
      formatDuration={flamegraph.formatter}
      getFrameColor={() => 'red'}
      onBottomUpClick={jest.fn()}
      onTopDownClick={jest.fn()}
      recursion={null}
      referenceNode={flamegraph.root}
      tree={flamegraph.root.children}
    />
  );

  return {canvasPoolManager, canvasScheduler};
}

function getRow(frameName: string) {
  return screen.getByRole('row', {name: new RegExp(frameName)});
}

function getFrameNames() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('gridcell')[2]?.textContent);
}

describe('FlamegraphTreeTable', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
  });

  it('renders root frames as collapsed tree rows when the tree is not expanded', () => {
    renderTreeTable();

    expect(screen.getByRole('treegrid', {name: 'Call tree'})).toBeInTheDocument();
    expect(getFrameNames()).toEqual(['root']);
    expect(getRow('root')).toHaveAttribute('aria-level', '1');
    expect(getRow('root')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the children of a frame when its expand button is clicked', async () => {
    renderTreeTable();

    await userEvent.click(within(getRow('root')).getByRole('button', {name: 'Expand'}));

    expect(getFrameNames()).toEqual(['root', 'parent', 'another']);
    expect(getRow('root')).toHaveAttribute('aria-expanded', 'true');
    expect(getRow('parent')).toHaveAttribute('aria-level', '2');
    expect(getRow('another')).not.toHaveAttribute('aria-expanded');
  });

  it('expands every descendant when the expand button is clicked with the meta key', async () => {
    renderTreeTable();
    const user = userEvent.setup();

    await user.keyboard('{Meta>}');
    await user.click(within(getRow('root')).getByRole('button', {name: 'Expand'}));
    await user.keyboard('{/Meta}');

    expect(getFrameNames()).toEqual(['root', 'parent', 'child', 'another']);
  });

  it('expands and moves the selection when arrow keys are pressed on a selected row', async () => {
    renderTreeTable();

    await userEvent.click(within(getRow('root')).getByRole('button', {name: 'Expand'}));
    await userEvent.click(getRow('parent'));
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowDown}');

    expect(getFrameNames()).toEqual(['root', 'parent', 'child', 'another']);
    expect(getRow('parent')).toHaveAttribute('aria-selected', 'false');
    expect(getRow('child')).toHaveAttribute('aria-selected', 'true');
    expect(getRow('child')).toHaveFocus();
  });

  it('selects the first row when it is tabbed to without a selection', async () => {
    renderTreeTable();

    act(() => screen.getByRole('button', {name: 'Frame'}).focus());
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(getRow('root')).toHaveFocus();
    expect(getRow('root')).toHaveAttribute('aria-selected', 'true');
    expect(getFrameNames()).toEqual(['root', 'parent', 'another']);
  });

  it('keeps the horizontal scroll position when a row is clicked', async () => {
    renderTreeTable();
    await userEvent.click(within(getRow('root')).getByRole('button', {name: 'Expand'}));
    const table = screen.getByRole('treegrid', {name: 'Call tree'});
    table.scrollLeft = 100;

    await userEvent.click(getRow('parent'));

    expect(getRow('parent')).toHaveAttribute('aria-selected', 'true');
    expect(table.scrollLeft).toBe(100);
  });

  it('keeps the horizontal scroll position when an arrow key selects a row whose indent is in view', async () => {
    renderTreeTable();
    await userEvent.click(within(getRow('root')).getByRole('button', {name: 'Expand'}));
    const table = screen.getByRole('treegrid', {name: 'Call tree'});
    jest.spyOn(table, 'clientWidth', 'get').mockReturnValue(800);
    await userEvent.click(getRow('parent'));
    table.scrollLeft = 10;

    await userEvent.keyboard('{ArrowDown}');

    expect(getRow('another')).toHaveAttribute('aria-selected', 'true');
    expect(table.scrollLeft).toBe(10);
  });

  it('scrolls to the indent when an arrow key selects a row whose indent is out of view', async () => {
    renderTreeTable();
    await userEvent.click(within(getRow('root')).getByRole('button', {name: 'Expand'}));
    const table = screen.getByRole('treegrid', {name: 'Call tree'});
    jest.spyOn(table, 'clientWidth', 'get').mockReturnValue(800);
    await userEvent.click(getRow('parent'));
    table.scrollLeft = 300;

    await userEvent.keyboard('{ArrowDown}');

    expect(getRow('another')).toHaveAttribute('aria-selected', 'true');
    expect(table.scrollLeft).toBe(14);
  });

  it('sorts frames by name when the frame header is clicked', async () => {
    renderTreeTable();

    await userEvent.click(within(getRow('root')).getByRole('button', {name: 'Expand'}));
    await userEvent.click(screen.getByRole('button', {name: 'Frame'}));

    expect(getFrameNames()).toEqual(['root', 'another', 'parent']);
  });

  it('selects and reveals a frame when the flamegraph shows it in the table', () => {
    const {canvasScheduler} = renderTreeTable();
    const child = flamegraph.frames.find(frame => frame.frame.name === 'child')!;

    act(() => canvasScheduler.dispatch('show in table view', child));

    expect(getFrameNames()).toEqual(['root', 'parent', 'child', 'another']);
    expect(getRow('child')).toHaveAttribute('aria-selected', 'true');
  });

  it('zooms to a frame on the flamegraph when chosen from its context menu', async () => {
    const {canvasPoolManager} = renderTreeTable();
    const dispatch = jest.spyOn(canvasPoolManager, 'dispatch');

    await userEvent.pointer({keys: '[MouseRight]', target: getRow('root')});
    await userEvent.click(screen.getByRole('menuitem', {name: 'Show on flamegraph'}));

    expect(dispatch).toHaveBeenCalledWith('zoom at frame', [
      flamegraph.root.children[0],
      'exact',
    ]);
  });
});
