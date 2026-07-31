import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {TabList, TabPanels, Tabs} from '.';

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

describe('Tabs', () => {
  it('renders tabs list', () => {
    render(
      <Tabs>
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
      </Tabs>
    );

    // The full tabs list is rendered
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getAllByRole('tab')).toHaveLength(TABS.length);
    TABS.forEach(tab => {
      expect(screen.getByRole('tab', {name: tab.label})).toBeInTheDocument();
    });

    // The first tab item is selected and its content visible
    expect(screen.getByRole('tab', {name: TABS[0].label})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[0].content)).toBeInTheDocument();
  });

  it('renders tabs list when disabled', () => {
    render(
      <Tabs disabled>
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
      </Tabs>
    );

    // The first tab item is selected and its content visible
    expect(screen.getByRole('tab', {name: TABS[0].label})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[0].content)).toBeInTheDocument();

    // All tabs are marked as disabled
    TABS.forEach(tab => {
      expect(screen.getByRole('tab', {name: tab.label})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  it('changes tabs on click', async () => {
    render(
      <Tabs>
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
      </Tabs>
    );

    // Click on the Activity tab
    await userEvent.click(screen.getByRole('tab', {name: 'Activity'}));

    // The Activity tab is selected and its content rendered
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[1].content)).toBeInTheDocument();
  });

  it('changes tabs using keyboard navigation', async () => {
    render(
      <Tabs>
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
      </Tabs>
    );

    // Focus on tab list
    await userEvent.tab();
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveFocus();

    // Press Arrow Right to select the next tab to the right (Activity)
    await userEvent.keyboard('{arrowRight}{enter}');

    // The Activity tab is selected and its contents rendered
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[1].content)).toBeInTheDocument();
  });

  it('changes tabs on key press in vertical orientation', async () => {
    render(
      <Tabs orientation="vertical">
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
      </Tabs>
    );

    // Focus on tab list
    await userEvent.tab();
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveFocus();

    // Press Arrow Right to select the next tab below (Activity)
    await userEvent.keyboard('{arrowRight}{enter}');

    // The Activity tab should now be selected and its contents rendered
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[1].content)).toBeInTheDocument();
  });

  it('renders disabled tabs', () => {
    render(
      <Tabs>
        <TabList>
          {TABS.map(tab => (
            <TabList.Item key={tab.key} disabled>
              {tab.label}
            </TabList.Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
          ))}
        </TabPanels>
      </Tabs>
    );

    TABS.forEach(tab => {
      expect(screen.getByRole('tab', {name: tab.label})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  it('renders tab links', async () => {
    render(
      <Tabs>
        <TabList>
          {TABS.map(tab => (
            <TabList.Item key={tab.key} to="/#some-link">
              {tab.label}
            </TabList.Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
          ))}
        </TabPanels>
      </Tabs>
    );

    TABS.forEach(tab => {
      const tabEl = screen.getByRole('tab', {name: tab.label});
      expect(within(tabEl).getByRole('link', {hidden: true})).toHaveAttribute(
        'href',
        '/#some-link'
      );
    });

    // Command/ctrl/shift-clicking on a tab link doesn't change the tab selection.
    // The expected behavior is that clicking on a tab link will open a new browser
    // tab/window. The current view shouldn't update.
    const secondTabEl = screen.getByRole('tab', {name: TABS[1].label});
    const secondTabLink = within(secondTabEl).getByRole('link', {hidden: true});

    const user = userEvent.setup();

    await user.keyboard('[MetaLeft>]');
    await user.click(secondTabLink);
    await user.keyboard('[/MetaLeft]');

    await user.keyboard('[ControlLeft>]');
    await user.click(secondTabLink);
    await user.keyboard('[/ControlLeft]');

    await user.keyboard('[ShiftLeft>]');
    await user.click(secondTabLink);
    await user.keyboard('[/ShiftLeft]');

    expect(screen.getByRole('tab', {name: TABS[0].label})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('should not allow disabled tabs to be links', () => {
    render(
      <Tabs>
        <TabList>
          {TABS.map(tab => (
            <TabList.Item key={tab.key} to="/#some-link" disabled>
              {tab.label}
            </TabList.Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
          ))}
        </TabPanels>
      </Tabs>
    );

    TABS.forEach(tab => {
      const tabEl = screen.getByRole('tab', {name: tab.label});
      expect(within(tabEl).queryByRole('link', {hidden: true})).not.toBeInTheDocument();
    });
  });
});

describe('Tabs overflow', () => {
  // Every tab measures this wide; the container width is varied per test to
  // control how many tabs fit. The component reserves 48px for the trigger.
  const TAB_WIDTH = 100;

  // Available width reported by the tab list wrapper, mutable so resizes can be
  // simulated. jsdom has no layout engine, so all measurement is mocked.
  let containerWidth = 1000;
  let resizeCallbacks: ResizeObserverCallback[] = [];
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    containerWidth = 1000;
    resizeCallbacks = [];

    // Each tab (<li role="tab">) measures TAB_WIDTH; everything else is 0.
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const width = this.getAttribute('role') === 'tab' ? TAB_WIDTH : 0;
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
        } as DOMRect;
      });

    // Only the tab list wrapper (whose direct child is the tablist) reports the
    // configured available width; everything else reports 0 (jsdom default).
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.querySelector(':scope > [role="tablist"]') ? containerWidth : 0;
      },
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
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Remove the prototype override so the jsdom default is restored.
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    window.ResizeObserver = originalResizeObserver;
  });

  function resizeContainerTo(width: number) {
    containerWidth = width;
    act(() => {
      resizeCallbacks.forEach(callback => callback([], {} as ResizeObserver));
    });
  }

  function renderTabs(orientation?: 'horizontal' | 'vertical') {
    return render(
      <Tabs orientation={orientation}>
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
      </Tabs>
    );
  }

  it('does not render an overflow menu when all tabs fit', () => {
    containerWidth = 1000;
    renderTabs();

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();
  });

  it('moves tabs that do not fit into an overflow menu', async () => {
    // Fits the first two tabs (budget = 260 - 48 = 212 => 2 * 100).
    containerWidth = 260;
    renderTabs();

    await userEvent.click(screen.getByRole('button', {name: 'More tabs'}));

    expect(screen.getByRole('option', {name: 'User Feedback'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Attachments'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Details'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Activity'})).not.toBeInTheDocument();
  });

  it('recomputes overflow when the container is resized', async () => {
    containerWidth = 1000;
    renderTabs();

    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();

    resizeContainerTo(260);
    await userEvent.click(await screen.findByRole('button', {name: 'More tabs'}));
    expect(screen.getByRole('option', {name: 'User Feedback'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Attachments'})).toBeInTheDocument();

    resizeContainerTo(1000);
    expect(screen.queryByRole('button', {name: 'More tabs'})).not.toBeInTheDocument();
  });

  it('activates an overflowing tab when selected from the menu', async () => {
    containerWidth = 260;
    renderTabs();

    await userEvent.click(screen.getByRole('button', {name: 'More tabs'}));
    await userEvent.click(screen.getByRole('option', {name: 'Attachments'}));

    expect(screen.getByRole('tab', {name: 'Attachments'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[3].content)).toBeInTheDocument();
  });

  it('never overflows tabs in vertical orientation', () => {
    containerWidth = 260;
    renderTabs('vertical');

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
        <Tabs>
          <TabList>
            {items.map(tab => (
              <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
            ))}
          </TabList>
        </Tabs>
      );
    }

    const {rerender} = render(<TabsWithItems items={TABS} />);

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
    expect(screen.getByRole('option', {name: 'Activity'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Attachments'})).not.toBeInTheDocument();
  });
});
