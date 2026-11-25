import {Fragment, useState, type ReactNode} from 'react';
import {ThemeProvider} from '@emotion/react';
import {act, render, screen, waitForElementToBeRemoved} from '@testing-library/react';
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

  // Width reported by the tab list wrapper, mutable so resizes can be
  // simulated. jsdom has no layout engine, so all measurement is mocked.
  let containerWidth = 1000;
  let resizeCallbacks: ResizeObserverCallback[] = [];
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    containerWidth = 1000;
    resizeCallbacks = [];

    // Each tab (<li role="tab">) measures TAB_WIDTH and the tab list wrapper
    // (whose direct child is the tablist) measures containerWidth; everything
    // else is 0.
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        let width = 0;
        if (this.matches('[role="tab"], :has(> [role="tab"])')) {
          width = TAB_WIDTH;
        } else if (this.matches(':has(> [role="tablist"])')) {
          width = containerWidth;
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

  function resizeContainerTo(width: number) {
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
