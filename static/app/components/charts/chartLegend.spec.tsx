import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {LegendItem} from './chartLegend';
import {ChartLegend} from './chartLegend';

// Mock useOverflowItems since IntersectionObserver is not available in JSDOM
jest.mock('./useOverflowItems', () => ({
  useOverflowItems: jest.fn((_containerRef, items) => ({
    visibleItems: items,
    overflowItems: [],
  })),
}));

const {useOverflowItems} = jest.requireMock('./useOverflowItems');

const ITEMS: LegendItem[] = [
  {name: 'series-a', label: 'Series A', color: '#ff0000'},
  {name: 'series-b', label: 'Series B', color: '#00ff00'},
  {name: 'series-c', label: 'Series C', color: '#0000ff'},
];

describe('ChartLegend', () => {
  beforeEach(() => {
    useOverflowItems.mockImplementation((_containerRef: unknown, items: unknown[]) => ({
      visibleItems: items,
      overflowItems: [],
    }));
  });

  it('renders all legend items', () => {
    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    expect(screen.getByText('Series A')).toBeInTheDocument();
    expect(screen.getByText('Series B')).toBeInTheDocument();
    expect(screen.getByText('Series C')).toBeInTheDocument();
  });

  it('renders nothing when items is empty', () => {
    const {container} = render(
      <ChartLegend items={[]} selected={{}} onSelectionChange={jest.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('toggles item selection when clicked', async () => {
    const onSelectionChange = jest.fn();
    render(
      <ChartLegend
        items={ITEMS}
        selected={{'series-a': true, 'series-b': true, 'series-c': true}}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click "Series B" toggle button
    await userEvent.click(screen.getByRole('button', {name: 'Toggle Series B'}));

    expect(onSelectionChange).toHaveBeenCalledWith({
      'series-a': true,
      'series-b': false,
      'series-c': true,
    });
  });

  it('re-enables a disabled item when clicked', async () => {
    const onSelectionChange = jest.fn();
    render(
      <ChartLegend
        items={ITEMS}
        selected={{'series-a': true, 'series-b': false, 'series-c': true}}
        onSelectionChange={onSelectionChange}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Toggle Series B'}));

    expect(onSelectionChange).toHaveBeenCalledWith({
      'series-a': true,
      'series-b': true,
      'series-c': true,
    });
  });

  it('treats missing keys in selected as true (visible)', () => {
    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    // All checkboxes should be checked when selected is empty
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeChecked();
    });
  });

  it('shows overflow trigger when items overflow', () => {
    // CompactSelect uses react-popper which triggers async state updates
    jest.spyOn(console, 'error').mockImplementation();

    useOverflowItems.mockImplementation(
      (_containerRef: unknown, items: LegendItem[]) => ({
        visibleItems: items.slice(0, 1),
        overflowItems: items.slice(1),
      })
    );

    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    expect(screen.getByText('2 more')).toBeInTheDocument();
  });

  it('does not show overflow trigger when nothing overflows', () => {
    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });
});
