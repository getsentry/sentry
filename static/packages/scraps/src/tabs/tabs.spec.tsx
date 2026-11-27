import {Fragment, type ReactNode} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen, within} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {expectTypeOf} from 'expect-type';

import {LinkTabs, Tabs} from '@sentry/scraps/tabs';
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
  it('requires destinations only for link tabs and infers their key union', () => {
    const value = 'details' as 'details' | 'activity';
    const linked = (
      <LinkTabs
        value={value}
        onChange={key => {
          expectTypeOf(key).toEqualTypeOf<'details' | 'activity'>();
        }}
      >
        {({TabList, TabPanels}) => (
          <Fragment>
            <TabList>
              <TabList.Item key="details" to="/details/">
                Details
              </TabList.Item>
              {/* @ts-expect-error Every link tab needs a destination. */}
              <TabList.Item key="activity">Activity</TabList.Item>
              {/* @ts-expect-error Item keys cannot widen the union from value. */}
              <TabList.Item key="unknown" to="/unknown/">
                Unknown
              </TabList.Item>
            </TabList>
            <TabPanels>
              <TabPanels.Item key="activity">Activity content</TabPanels.Item>
              {/* @ts-expect-error Panel keys must belong to the value union. */}
              <TabPanels.Item key="unknown">Unknown content</TabPanels.Item>
            </TabPanels>
          </Fragment>
        )}
      </LinkTabs>
    );
    const selection = (
      <Tabs defaultValue="details">
        {({TabList}) => (
          <TabList>
            {/* @ts-expect-error State tabs cannot navigate. */}
            <TabList.Item key="details" to="/details/">
              Details
            </TabList.Item>
          </TabList>
        )}
      </Tabs>
    );
    expectTypeOf(linked).not.toBeAny();
    expectTypeOf(selection).not.toBeAny();
  });

  it('requires an observed value and keeps link callback keys narrow', () => {
    // @ts-expect-error The URL controls selection; value is required.
    const missingValue = <LinkTabs>{() => null}</LinkTabs>;
    const defaultValue = (
      // @ts-expect-error Link tabs cannot have independent default selection.
      <LinkTabs value="details" defaultValue="activity">
        {() => null}
      </LinkTabs>
    );
    const onChange = (
      <LinkTabs
        value={'details' as 'details' | 'activity'}
        // @ts-expect-error The callback must accept the whole inferred key union.
        onChange={(_key: 'details') => {}}
      >
        {() => null}
      </LinkTabs>
    );
    const automatic = (
      // @ts-expect-error Keyboard focus cannot automatically select a URL-backed panel.
      <LinkTabs value="details" keyboardActivation="automatic">
        {() => null}
      </LinkTabs>
    );
    const disabledKeys = (
      // @ts-expect-error Disabled keys cannot widen the inferred union.
      <LinkTabs value={'details' as 'details' | 'activity'} disabledKeys={['unknown']}>
        {() => null}
      </LinkTabs>
    );
    expectTypeOf(missingValue).not.toBeAny();
    expectTypeOf(defaultValue).not.toBeAny();
    expectTypeOf(onChange).not.toBeAny();
    expectTypeOf(automatic).not.toBeAny();
    expectTypeOf(disabledKeys).not.toBeAny();
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
      <Tabs
        value={'details' as 'details' | 'activity'}
        onChange={(_key: string | number) => {}}
        // @ts-expect-error Disabled keys must belong to the selected key type.
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
        // @ts-expect-error The callback must accept the whole selected key union.
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
    expectTypeOf(missingSelection).not.toBeAny();
    expectTypeOf(mixedSelection).not.toBeAny();
    expectTypeOf(missingControlledHandler).not.toBeAny();
    expectTypeOf(undefinedSelection).not.toBeAny();
  });

  it('does not infer a literal key type from an uncontrolled default', () => {
    const element = (
      <Tabs defaultValue="foo">
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
                <TabList.Item key="bar">Bar</TabList.Item>
              </TabList>
              <TabPanels>
                <TabPanels.Item key="bar">Bar content</TabPanels.Item>
              </TabPanels>
            </Fragment>
          );
        }}
      </Tabs>
    );
    expectTypeOf(element).not.toBeAny();
  });

  it('infers uncontrolled item keys from a typed callback', () => {
    const element = (
      <Tabs defaultValue="foo" onChange={(_key: 'foo' | 'bar') => {}}>
        {({TabList, TabPanels}) => {
          expectTypeOf<Parameters<typeof TabList.Item>[0]['key']>().toEqualTypeOf<
            'foo' | 'bar'
          >();
          expectTypeOf<Parameters<typeof TabPanels.Item>[0]['key']>().toEqualTypeOf<
            'foo' | 'bar'
          >();
          return (
            <Fragment>
              <TabList>
                <TabList.Item key="bar">Bar</TabList.Item>
              </TabList>
              <TabPanels>
                <TabPanels.Item key="bar">Bar content</TabPanels.Item>
              </TabPanels>
            </Fragment>
          );
        }}
      </Tabs>
    );
    expectTypeOf(element).not.toBeAny();
  });

  it('checks uncontrolled defaults and items against callback keys without widening', () => {
    const element = (
      // @ts-expect-error The default must belong to the callback key union.
      <Tabs defaultValue="unknown" onChange={(_key: 'foo' | 'bar') => {}}>
        {({TabList, TabPanels}) => (
          <Fragment>
            <TabList>
              {/* @ts-expect-error List keys must belong to the callback key union. */}
              <TabList.Item key="unknown">Unknown</TabList.Item>
            </TabList>
            <TabPanels>
              {/* @ts-expect-error Panel keys must belong to the callback key union. */}
              <TabPanels.Item key="unknown">Unknown content</TabPanels.Item>
            </TabPanels>
          </Fragment>
        )}
      </Tabs>
    );
    expectTypeOf(element).not.toBeAny();
    const invalidDisabledKey = (
      <Tabs
        defaultValue="foo"
        onChange={(_key: 'foo' | 'bar') => {}}
        // @ts-expect-error Disabled keys must belong to the callback key union.
        disabledKeys={['unknown']}
      >
        {() => null}
      </Tabs>
    );
    expectTypeOf(invalidDisabledKey).not.toBeAny();
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
          <Fragment>
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
          </Fragment>
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
      <LinkTabs value={'details' as (typeof TABS)[number]['key']}>
        {({TabList, TabPanels}) => (
          <Fragment>
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
          </Fragment>
        )}
      </LinkTabs>,
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
      <LinkTabs value={'details' as (typeof TABS)[number]['key']}>
        {({TabList, TabPanels}) => (
          <Fragment>
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
          </Fragment>
        )}
      </LinkTabs>,
      {wrapper: ThemeWrapper}
    );

    TABS.forEach(tab => {
      const tabEl = screen.getByRole('tab', {name: tab.label});
      expect(within(tabEl).queryByRole('link', {hidden: true})).not.toBeInTheDocument();
    });
  });
});

function ThemeWrapper({children}: {children: ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
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
        <TabList>
          <TabList.Item key="details">Details</TabList.Item>
          <TabList.Item key="activity">Activity</TabList.Item>
        </TabList>
      )}
    </Tabs>
  );
}
