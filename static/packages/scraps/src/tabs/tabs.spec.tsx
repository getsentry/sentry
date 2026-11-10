import {Fragment, type ReactNode} from 'react';
import {ThemeProvider} from '@emotion/react';
import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {expectTypeOf} from 'expect-type';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
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

describe('Tabs', () => {
  it('renders caller content as direct Grid children', async () => {
    render(
      <Grid role="group" aria-label="Tabs layout" columns="auto 1fr">
        <Tabs defaultValue="details">
          {({TabList, TabPanels}) => (
            <Fragment>
              <TabList aria-label="Sections">
                <TabList.Item key="details">Details</TabList.Item>
                <TabList.Item key="activity">Activity</TabList.Item>
              </TabList>
              <TabPanels>
                <TabPanels.Item key="details">Details content</TabPanels.Item>
                <TabPanels.Item key="activity">Activity content</TabPanels.Item>
              </TabPanels>
            </Fragment>
          )}
        </Tabs>
      </Grid>,
      {wrapper: ThemeWrapper}
    );

    const layout = screen.getByRole('group', {name: 'Tabs layout'});
    const panel = screen.getByRole('tabpanel');
    // oxlint-disable-next-line testing-library/no-node-access -- The root API must not insert a DOM element around caller content.
    expect(panel.parentElement).toBe(layout);
    // oxlint-disable-next-line testing-library/no-node-access -- The tab list wrapper must remain a direct child of the caller's layout.
    expect(layout.children).toHaveLength(2);

    await userEvent.click(screen.getByRole('tab', {name: 'Activity'}));

    expect(screen.getByRole('tabpanel')).toHaveTextContent('Activity content');
    expect(screen.queryByText('Details content')).not.toBeInTheDocument();
  });

  it('infers the same key union for selection, list items, and panels', async () => {
    const onChange = jest.fn();
    render(
      <Tabs
        value={'details' as 'details' | 'activity'}
        onChange={key => {
          expectTypeOf(key).toEqualTypeOf<'details' | 'activity'>();
          onChange(key);
        }}
      >
        {({TabList, TabPanels}) => {
          expectTypeOf<Parameters<typeof TabList.Item>[0]['key']>().toEqualTypeOf<
            'details' | 'activity'
          >();
          expectTypeOf<Parameters<typeof TabPanels.Item>[0]['key']>().toEqualTypeOf<
            'details' | 'activity'
          >();
          return (
            <Fragment>
              <TabList>
                <TabList.Item key="details">Details</TabList.Item>
                <TabList.Item key="activity">Activity</TabList.Item>
              </TabList>
              <TabPanels>
                <TabPanels.Item key="details">Details content</TabPanels.Item>
                <TabPanels.Item key="activity">Activity content</TabPanels.Item>
              </TabPanels>
            </Fragment>
          );
        }}
      </Tabs>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('tab', {name: 'Activity'}));
    expect(onChange).toHaveBeenCalledWith('activity');
  });

  it('checks keys without widening from a broad selection callback', () => {
    const element = (
      // @ts-expect-error Disabled keys must belong to the selected key type.
      <Tabs
        value={'details' as 'details' | 'activity'}
        onChange={(_key: string | number) => {}}
        disabledKeys={['unknown']}
      >
        {({TabList, TabPanels}) => (
          <Fragment>
            <TabList>
              {/* @ts-expect-error List keys must belong to the selected key type. */}
              <TabList.Item key="unknown">Unknown</TabList.Item>
            </TabList>
            <TabPanels>
              {/* @ts-expect-error Panel keys must belong to the selected key type. */}
              <TabPanels.Item key="unknown">Unknown content</TabPanels.Item>
            </TabPanels>
          </Fragment>
        )}
      </Tabs>
    );
    expectTypeOf(element).not.toBeAny();

    const narrowCallback = (
      <Tabs
        value={'details' as 'details' | 'activity'}
        // @ts-expect-error A callback must accept every possible selected key.
        onChange={(_key: 'details') => {}}
      >
        {() => null}
      </Tabs>
    );
    expectTypeOf(narrowCallback).not.toBeAny();
  });

  it('keeps uncontrolled keys as strings regardless of the default', async () => {
    const onChange = jest.fn();
    render(
      <Tabs
        defaultValue="activity"
        onChange={key => {
          expectTypeOf(key).toEqualTypeOf<string>();
          onChange(key);
        }}
      >
        {({TabList, TabPanels}) => {
          expectTypeOf<
            Parameters<typeof TabList.Item>[0]['key']
          >().toEqualTypeOf<string>();
          expectTypeOf<
            Parameters<typeof TabPanels.Item>[0]['key']
          >().toEqualTypeOf<string>();
          return (
            <Fragment>
              <TabList>
                <TabList.Item key="details">Details</TabList.Item>
                <TabList.Item key="activity">Activity</TabList.Item>
              </TabList>
              <TabPanels>
                <TabPanels.Item key="details">Details content</TabPanels.Item>
                <TabPanels.Item key="activity">Activity content</TabPanels.Item>
              </TabPanels>
            </Fragment>
          );
        }}
      </Tabs>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Activity content');

    await userEvent.click(screen.getByRole('tab', {name: 'Details'}));

    expect(onChange).toHaveBeenCalledWith('details');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Details content');
  });

  it('rejects numeric selection values and item keys', () => {
    const element = (
      <Tabs value={'details' as 'details' | 'activity'} onChange={() => {}}>
        {({TabList, TabPanels}) => (
          <Fragment>
            <TabList>
              {/* @ts-expect-error Tab keys must be strings. */}
              <TabList.Item key={1}>Numeric key</TabList.Item>
            </TabList>
            <TabPanels>
              {/* @ts-expect-error Panel keys must be strings. */}
              <TabPanels.Item key={1}>Numeric content</TabPanels.Item>
            </TabPanels>
          </Fragment>
        )}
      </Tabs>
    );
    expectTypeOf(element).not.toBeAny();

    const controlled = (
      // @ts-expect-error Selected values must be strings.
      <Tabs value={1} onChange={() => {}}>
        {() => null}
      </Tabs>
    );
    expectTypeOf(controlled).not.toBeAny();

    const uncontrolled = (
      // @ts-expect-error Default values must be strings.
      <Tabs defaultValue={1}>{() => null}</Tabs>
    );
    expectTypeOf(uncontrolled).not.toBeAny();

    const numericType = (
      // @ts-expect-error The key type must extend string.
      <Tabs<0 | 1> defaultValue="details">{() => null}</Tabs>
    );
    expectTypeOf(numericType).not.toBeAny();
  });

  it('requires exactly one selection mode and a controlled change handler', () => {
    const missingSelection = (
      // @ts-expect-error A selected value or default value is required.
      <Tabs>{() => null}</Tabs>
    );
    const mixedSelection = (
      // @ts-expect-error Controlled tabs cannot also provide a default value.
      <Tabs value="details" defaultValue="activity" onChange={() => {}}>
        {() => null}
      </Tabs>
    );
    const missingControlledHandler = (
      // @ts-expect-error Controlled tabs require a change handler.
      <Tabs value="details">{() => null}</Tabs>
    );
    const undefinedSelection = (
      // @ts-expect-error An undefined value does not supply a selection mode.
      <Tabs value={undefined} onChange={() => {}}>
        {() => null}
      </Tabs>
    );
    const narrowUncontrolledHandler = (
      <Tabs
        defaultValue="activity"
        // @ts-expect-error Uncontrolled callbacks must accept any string key.
        onChange={(_key: 'details' | 'activity') => {}}
      >
        {() => null}
      </Tabs>
    );

    expectTypeOf(missingSelection).not.toBeAny();
    expectTypeOf(mixedSelection).not.toBeAny();
    expectTypeOf(missingControlledHandler).not.toBeAny();
    expectTypeOf(undefinedSelection).not.toBeAny();
    expectTypeOf(narrowUncontrolledHandler).not.toBeAny();
  });

  it('does not restrict uncontrolled items to the default or disabled keys', () => {
    const element = (
      <Tabs defaultValue="activity" disabledKeys={['disabled']}>
        {({TabList, TabPanels}) => {
          expectTypeOf<
            Parameters<typeof TabList.Item>[0]['key']
          >().toEqualTypeOf<string>();
          expectTypeOf<
            Parameters<typeof TabPanels.Item>[0]['key']
          >().toEqualTypeOf<string>();
          return (
            <Fragment>
              <TabList>
                <TabList.Item key="details">Details</TabList.Item>
              </TabList>
              <TabPanels>
                <TabPanels.Item key="details">Details content</TabPanels.Item>
              </TabPanels>
            </Fragment>
          );
        }}
      </Tabs>
    );
    expectTypeOf(element).not.toBeAny();
  });

  it('renders tabs list', () => {
    render(
      <Tabs defaultValue="details">
        {({TabList, TabPanels}) => (
          <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
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
          </Stack>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
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
      <Tabs defaultValue="details" disabled>
        {({TabList, TabPanels}) => (
          <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
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
          </Stack>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
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
      <Tabs defaultValue="details">
        {({TabList, TabPanels}) => (
          <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
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
          </Stack>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
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

  it('keeps local selection controlled by the consumer', async () => {
    const onChange = jest.fn();
    const {rerender} = render(<ControlledTabs value="details" onChange={onChange} />, {
      wrapper: ThemeWrapper,
    });

    await userEvent.click(screen.getByRole('tab', {name: 'Activity'}));

    expect(onChange).toHaveBeenCalledWith('activity');
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    rerender(<ControlledTabs value="activity" onChange={onChange} />);

    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each([
    {activation: 'manual', keys: '{ArrowRight}{Enter}'},
    {activation: 'automatic', keys: '{ArrowRight}'},
  ] as const)(
    'changes tabs using $activation keyboard activation',
    async ({activation, keys}) => {
      render(
        <Tabs defaultValue="details" keyboardActivation={activation}>
          {({TabList, TabPanels}) => (
            <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
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
            </Stack>
          )}
        </Tabs>,
        {wrapper: ThemeWrapper}
      );

      // Focus on tab list
      await userEvent.tab();
      expect(screen.getByRole('tab', {name: 'Details'})).toHaveFocus();

      await userEvent.keyboard(keys);

      // The Activity tab is selected and its contents rendered
      expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByText(TABS[1].content)).toBeInTheDocument();
    }
  );

  it('changes tabs on key press in vertical orientation', async () => {
    render(
      <Tabs defaultValue="details" orientation="vertical">
        {({TabList, TabPanels}) => (
          <Flex
            direction="row"
            flexGrow={1}
            minWidth="0"
            flexBasis="auto"
            alignSelf="auto"
            height="100%"
            align="stretch"
          >
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
          </Flex>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
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
      <Tabs defaultValue="details">
        {({TabList, TabPanels}) => (
          <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
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
          </Stack>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
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
      <Tabs defaultValue="details">
        {({TabList, TabPanels}) => (
          <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
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
          </Stack>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
    );

    TABS.forEach(tab => {
      const tabEl = screen.getByRole('tab', {name: tab.label});
      expect(tabEl).toHaveAttribute('href', '/#some-link');
    });

    // Command/ctrl/shift-clicking on a tab link doesn't change the tab selection.
    // The expected behavior is that clicking on a tab link will open a new browser
    // tab/window. The current view shouldn't update.
    const secondTabEl = screen.getByRole('tab', {name: TABS[1].label});
    const secondTabLink = secondTabEl;

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
      <Tabs defaultValue="details">
        {({TabList, TabPanels}) => (
          <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
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
          </Stack>
        )}
      </Tabs>,
      {wrapper: ThemeWrapper}
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

  // Widths reported by each tab and by the tab list wrapper, mutable so resizes
  // can be simulated. jsdom has no layout engine, so all measurement is mocked.
  let tabWidth = TAB_WIDTH;
  let containerWidth = 1000;
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
            <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
              <TabList>
                {items.map(tab => (
                  <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                ))}
              </TabList>
            </Stack>
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
        <Flex
          direction={orientation === 'vertical' ? 'row' : 'column'}
          flexGrow={1}
          minWidth="0"
          flexBasis={orientation === 'vertical' ? 'auto' : '0'}
          alignSelf={orientation === 'vertical' ? 'auto' : 'stretch'}
          height={orientation === 'vertical' ? '100%' : undefined}
          align={orientation === 'vertical' ? 'stretch' : undefined}
        >
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
        </Flex>
      )}
    </Tabs>
  );
}

function ControlledTabs({
  value,
  onChange,
}: {
  onChange: (key: 'details' | 'activity') => void;
  value: 'details' | 'activity';
}) {
  return (
    <Tabs value={value} onChange={onChange}>
      {({TabList}) => (
        <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
          <TabList>
            <TabList.Item key="details">Details</TabList.Item>
            <TabList.Item key="activity">Activity</TabList.Item>
          </TabList>
        </Stack>
      )}
    </Tabs>
  );
}
