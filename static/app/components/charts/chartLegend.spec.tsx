import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {LegendItem} from './chartLegend';
import {ChartLegend} from './chartLegend';

const ITEMS: LegendItem[] = [
  {name: 'series-a', label: 'Series A', color: '#ff0000'},
  {name: 'series-b', label: 'Series B', color: '#00ff00'},
  {name: 'series-c', label: 'Series C', color: '#0000ff'},
];

// Stub ResizeObserver — JSDOM doesn't provide it
let resizeCallbacks: Array<() => void> = [];
class MockResizeObserver {
  constructor(cb: () => void) {
    resizeCallbacks.push(cb);
  }
  observe() {}
  disconnect() {}
}

/**
 * Mock the items container to have a given width, with each child taking 80px.
 * This controls whether items overflow (container too narrow) or fit (wide).
 */
function mockContainerWidth(width: number) {
  const itemsContainer = screen.getByTestId('legend-items');
  // Mock the wrapper (parent) offsetWidth — computeOverflowIndex reads
  // the wrapper's width as total available space to avoid double-counting
  // when the trigger shrinks the flex:1 items container.
  const wrapper = itemsContainer.parentElement!;
  Object.defineProperty(wrapper, 'offsetWidth', {
    value: width,
    configurable: true,
  });
  Array.from(itemsContainer.children).forEach(child => {
    jest.spyOn(child, 'getBoundingClientRect').mockReturnValue({
      width: 80,
    } as DOMRect);
  });
}

async function triggerResize() {
  await act(async () => {
    resizeCallbacks.forEach(cb => cb());
    await Promise.resolve(); // flush scheduleMicroTask
  });
}

describe('ChartLegend', () => {
  const originalResizeObserver = window.ResizeObserver;

  beforeEach(() => {
    resizeCallbacks = [];
    window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.ResizeObserver = originalResizeObserver;
  });

  it('renders all legend items', async () => {
    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    mockContainerWidth(1000);
    await triggerResize();

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

    mockContainerWidth(1000);
    await triggerResize();

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

    mockContainerWidth(1000);
    await triggerResize();

    await userEvent.click(screen.getByRole('button', {name: 'Toggle Series B'}));

    expect(onSelectionChange).toHaveBeenCalledWith({
      'series-a': true,
      'series-b': true,
      'series-c': true,
    });
  });

  it('treats missing keys in selected as true (visible)', async () => {
    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    mockContainerWidth(1000);
    await triggerResize();

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeChecked();
    });
  });

  it('shows overflow trigger when items overflow', async () => {
    jest.spyOn(console, 'error').mockImplementation();

    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    mockContainerWidth(100);
    await triggerResize();

    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('does not show overflow trigger when nothing overflows', async () => {
    render(<ChartLegend items={ITEMS} selected={{}} onSelectionChange={jest.fn()} />);

    mockContainerWidth(1000);
    await triggerResize();

    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('fires callback when an overflow item is toggled via the dropdown', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    const onSelectionChange = jest.fn();

    render(
      <ChartLegend
        items={ITEMS}
        selected={{'series-a': true, 'series-b': true, 'series-c': true}}
        onSelectionChange={onSelectionChange}
      />
    );

    mockContainerWidth(100);
    await triggerResize();

    // Open the overflow dropdown
    await userEvent.click(screen.getByText('+2 more'));

    // Click "Series B" inside the dropdown
    await userEvent.click(screen.getByRole('option', {name: 'Series B'}));

    expect(onSelectionChange).toHaveBeenCalledWith({
      'series-a': true,
      'series-b': false,
      'series-c': true,
    });
  });
});
