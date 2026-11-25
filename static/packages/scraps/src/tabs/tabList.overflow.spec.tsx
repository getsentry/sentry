import {Fragment, useState, type ReactNode} from 'react';
import {ThemeProvider} from '@emotion/react';
import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {Tabs} from '@sentry/scraps/tabs';
import {lightTheme} from '@sentry/scraps/theme';

const TABS = [
  {key: 'details', label: 'Details', content: 'So by colonel hearted ferrars.'},
  {
    key: 'activity',
    label: 'Activity',
    content:
      'Draw from upon here gone add one. He in sportsman household otherwise it perceived instantly.',
  },
  {
    key: 'user-feedback',
    label: 'User Feedback',
    content: 'Is inquiry no he several excited am.',
  },
  {
    key: 'attachments',
    label: 'Attachments',
    content: 'Called though excuse length ye needed it he having.',
  },
] as const;

describe('Tabs overflow', () => {
  // Every tab measures this wide; the container width is varied per test to
  // control how many tabs fit. The component reserves 48px for the trigger.
  const TAB_WIDTH = 100;

  // Widths reported by each tab and by the tab list wrapper, mutable so resizes
  // can be simulated. jsdom has no layout engine, so all measurement is mocked.
  // A `'content'` wrapper is as wide as the tabs it lays out.
  let tabWidth = TAB_WIDTH;
  let containerWidth: number | 'content' = 1000;
  let resizeCallbacks: ResizeObserverCallback[] = [];
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    tabWidth = TAB_WIDTH;
    containerWidth = 1000;
    resizeCallbacks = [];

    // Each tab (<li role="tab">) measures tabWidth and the tab list wrapper
    // (whose direct child is the tablist) measures containerWidth; everything
    // else is 0.
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        let width = 0;
        if (
          this.getAttribute('role') === 'tab' ||
          // oxlint-disable-next-line testing-library/no-node-access -- jsdom requires explicit geometry for each measured wrapper.
          this.querySelector(':scope > [role="tab"]')
        ) {
          width = tabWidth;
          // oxlint-disable-next-line testing-library/no-node-access -- jsdom requires explicit geometry for each measured wrapper.
        } else if (this.querySelector(':scope > [role="tablist"]')) {
          width =
            containerWidth === 'content'
              ? within(this)
                  .queryAllByRole('tab', {hidden: true})
                  .filter(tab => getComputedStyle(tab).display !== 'none').length *
                tabWidth
              : containerWidth;
        }
        return {
          width,
          height: 0,
          top: 0,
          bottom: 0,
          left: 0,
          right: width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });

    // Controllable ResizeObserver so resizes can be triggered on demand (the
    // global mock is a no-op).
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.ResizeObserver = originalResizeObserver;
  });

  function resizeContainerTo(width: typeof containerWidth) {
    containerWidth = width;
    act(() => {
      resizeCallbacks.forEach(callback => callback([], {} as ResizeObserver));
    });
  }

  it('does not render an overflow menu when all tabs fit', () => {
    containerWidth = 1000;
    render(<OverflowTabs />, {wrapper: ThemeWrapper});

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();
  });

  it('does not overflow when the tabs fill the container to a fraction of a pixel', async () => {
    // A shrink-to-fit container is exactly as wide as its tabs, which is not a
    // whole number of pixels. Rounding the container down would push the last
    // tab into the menu, shrink the container around the remaining tabs, and
    // repeat until only the first tab is left.
    const gap = 4;
    const realGetComputedStyle = window.getComputedStyle;
    jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(element =>
        element.getAttribute('role') === 'tablist'
          ? ({columnGap: `${gap}px`} as CSSStyleDeclaration)
          : realGetComputedStyle(element)
      );
    tabWidth = 100.125;
    const tabsWithGaps = TABS.length * tabWidth + (TABS.length - 1) * gap;
    containerWidth = tabsWithGaps;
    render(<OverflowTabs />, {wrapper: ThemeWrapper});

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(TABS.length);

    // When the page is zoomed, the tabs can measure a fraction of a pixel wider
    // than the container that holds them exactly. They still fit.
    resizeContainerTo(tabsWithGaps - 0.02);
    // The resize is handled on the next animation frame.
    await act(() => new Promise(requestAnimationFrame));

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();

    // One pixel less than the tabs and their gaps must overflow, which only
    // holds if the gaps are counted.
    resizeContainerTo(tabsWithGaps - 1);

    expect(await screen.findByRole('button', {name: 'More tabs'})).toBeInTheDocument();
  });

  it('moves tabs that do not fit into an overflow menu', async () => {
    // Fits the first two tabs (budget = 260 - 48 = 212 => 2 * 100).
    containerWidth = 260;
    render(<OverflowTabs />, {wrapper: ThemeWrapper});

    await userEvent.click(screen.getByRole('button', {name: 'More tabs'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'User Feedback'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Attachments'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Details'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Activity'})
    ).not.toBeInTheDocument();
  });

  it('keeps the first tab visible when only it and the overflow trigger fit', async () => {
    containerWidth = 120;
    render(<OverflowTabs />, {wrapper: ThemeWrapper});

    expect(screen.getByRole('tab', {name: 'Details'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'More tabs'}));

    expect(
      screen.queryByRole('menuitemradio', {name: 'Details'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Activity'})).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'User Feedback'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Attachments'})).toBeInTheDocument();
  });

  it('recomputes overflow when the container is resized', async () => {
    containerWidth = 1000;
    render(<OverflowTabs />, {wrapper: ThemeWrapper});

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();

    resizeContainerTo(260);
    await userEvent.click(await screen.findByRole('button', {name: 'More tabs'}));
    expect(
      screen.getByRole('menuitemradio', {name: 'User Feedback'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Attachments'})).toBeInTheDocument();

    resizeContainerTo(1000);
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('button', {name: 'More tabs'})
    );
  });

  it('shows every tab again when a content-sized container grows back', async () => {
    // If hiding an overflowing tab shrank a content-sized container, the hidden
    // tabs would never fit again.
    containerWidth = 'content';
    render(<OverflowTabs />, {wrapper: ThemeWrapper});

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();

    resizeContainerTo(260);
    expect(await screen.findByRole('button', {name: 'More tabs'})).toBeInTheDocument();

    resizeContainerTo('content');
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('button', {name: 'More tabs'})
    );
  });

  it.each(['click', 'keyboard'])(
    'activates an overflowing tab by %s and closes the menu',
    async interaction => {
      containerWidth = 260;
      render(<OverflowTabs />, {wrapper: ThemeWrapper});

      await userEvent.click(screen.getByRole('button', {name: 'More tabs'}));
      if (interaction === 'click') {
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Attachments'}));
      } else {
        await userEvent.keyboard('{End}{Enter}');
      }

      expect(screen.getByRole('tab', {selected: true, hidden: true})).toHaveTextContent(
        'Attachments'
      );
      expect(screen.getByText(TABS[3].content)).toBeInTheDocument();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    }
  );

  describe('with tooltips', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not show the tooltip of an overflowing tab', async () => {
      // Fits the first two tabs (budget = 260 - 48 = 212 => 2 * 100).
      containerWidth = 260;
      render(
        <Tabs defaultValue="details">
          {({TabList}) => (
            <TabList>
              {TABS.map(tab => (
                <TabList.Item key={tab.key} tooltip={{title: `${tab.label} tooltip`}}>
                  {tab.label}
                </TabList.Item>
              ))}
            </TabList>
          )}
        </Tabs>,
        {wrapper: ThemeWrapper}
      );
      expect(await screen.findByRole('button', {name: 'More tabs'})).toBeInTheDocument();

      // The overflowing tab is invisible but still takes up space, so the pointer
      // can land on it.
      const user = userEvent.setup({
        pointerEventsCheck: 0,
        advanceTimers: jest.advanceTimersByTime,
      });
      await user.hover(screen.getByRole('tab', {name: 'Details'}));
      expect(await screen.findByText('Details tooltip')).toBeInTheDocument();

      await user.hover(screen.getByText('Attachments'));
      act(() => jest.advanceTimersByTime(1000));
      expect(screen.queryByText('Attachments tooltip')).not.toBeInTheDocument();
    });

    it('keeps the state of a tab with a tooltip while it overflows', async () => {
      function RenamableLabel() {
        const [label, setLabel] = useState('Attachments');
        return <span onClick={() => setLabel('Renamed')}>{label}</span>;
      }

      render(
        <Tabs defaultValue="details">
          {({TabList}) => (
            <TabList>
              {TABS.map(tab => (
                <TabList.Item
                  key={tab.key}
                  textValue={tab.label}
                  tooltip={{title: `${tab.label} tooltip`}}
                >
                  {tab.key === 'attachments' ? <RenamableLabel /> : tab.label}
                </TabList.Item>
              ))}
            </TabList>
          )}
        </Tabs>,
        {wrapper: ThemeWrapper}
      );

      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      await user.click(screen.getByText('Attachments'));
      expect(screen.getByRole('tab', {name: 'Renamed'})).toBeInTheDocument();

      resizeContainerTo(260);
      act(() => jest.runOnlyPendingTimers());
      expect(screen.getByRole('button', {name: 'More tabs'})).toBeInTheDocument();

      resizeContainerTo(1000);
      act(() => jest.runOnlyPendingTimers());
      expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Renamed'})).toBeInTheDocument();
    });
  });

  it('keeps the content of an overflowing tab out of the accessibility tree', async () => {
    containerWidth = 260;
    render(
      <Tabs defaultValue="details">
        {({TabList}) => (
          <TabList>
            {TABS.map(tab => (
              <TabList.Item key={tab.key} textValue={tab.label}>
                {tab.label}
                {tab.key === 'attachments' && (
                  // A descendant can override the tab's `visibility: hidden`.
                  <a href="#status" style={{visibility: 'visible'}}>
                    Status
                  </a>
                )}
              </TabList.Item>
            ))}
          </TabList>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
    );

    expect(await screen.findByRole('button', {name: 'More tabs'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Status'})).not.toBeInTheDocument();
  });

  it('never overflows tabs in vertical orientation', () => {
    containerWidth = 260;
    render(<OverflowTabs orientation="vertical" />, {wrapper: ThemeWrapper});

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();
  });

  it('recomputes overflow when tabs are reordered without a resize', async () => {
    // Fits the first three tabs (budget = 380 - 48 = 332 >= 3 * 100).
    containerWidth = 380;

    function TabsWithItems({
      items,
    }: {
      items: ReadonlyArray<{key: string; label: string}>;
    }) {
      return (
        <Tabs defaultValue="details">
          {({TabList}) => (
            <TabList>
              {items.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
          )}
        </Tabs>
      );
    }

    const {rerender} = render(<TabsWithItems items={TABS} />, {wrapper: ThemeWrapper});

    // Initially the trailing tab (Attachments) is the one that overflows.
    expect(screen.getByRole('button', {name: 'More tabs'})).toBeInTheDocument();

    // Reorder so Activity becomes the trailing tab. The total width is
    // unchanged, so the ResizeObserver never fires – overflow must still be
    // recomputed from the new order.
    rerender(
      <TabsWithItems
        items={[
          {key: 'details', label: 'Details'},
          {key: 'user-feedback', label: 'User Feedback'},
          {key: 'attachments', label: 'Attachments'},
          {key: 'activity', label: 'Activity'},
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'More tabs'}));

    // The new trailing tab overflows; the previously-overflowing one is now
    // visible (not stuck in the menu based on the old order).
    expect(screen.getByRole('menuitemradio', {name: 'Activity'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Attachments'})
    ).not.toBeInTheDocument();
  });
});

function ThemeWrapper({children}: {children: ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function OverflowTabs({orientation}: {orientation?: 'horizontal' | 'vertical'}) {
  return (
    <Tabs defaultValue="details" orientation={orientation}>
      {({TabList, TabPanels}) => (
        <Fragment>
          <TabList>
            {TABS.map(tab => (
              <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
            ))}
          </TabList>
          <TabPanels>
            {TABS.map(tab => (
              <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
            ))}
          </TabPanels>
        </Fragment>
      )}
    </Tabs>
  );
}
