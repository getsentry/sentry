import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';

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
];

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

  it('changes tabs on click', () => {
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
    userEvent.click(screen.getByRole('tab', {name: 'Activity'}));

    // The Activity tab is selected and its content rendered
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[1].content)).toBeInTheDocument();
  });

  it('changes tabs using keyboard navigation', () => {
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
    userEvent.tab();
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveFocus();

    // Press Arrow Right to select the next tab to the right (Activity)
    userEvent.keyboard('{arrowRight}{enter}');

    // The Activity tab is selected and its contents rendered
    expect(screen.getByRole('tab', {name: 'Activity'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[1].content)).toBeInTheDocument();
  });

  it('changes tabs on key press in vertical orientation', () => {
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
    userEvent.tab();
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveFocus();

    // Press Arrow Right to select the next tab below (Activity)
    userEvent.keyboard('{arrowDown}{enter}');

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

  it('renders tab links', () => {
    const routerContext = TestStubs.routerContext();
    render(
      <Tabs>
        <TabList>
          {TABS.map(tab => (
            <TabList.Item key={tab.key} to="/some-link">
              {tab.label}
            </TabList.Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
          ))}
        </TabPanels>
      </Tabs>,
      {context: routerContext}
    );

    TABS.forEach(tab => {
      const tabEl = screen.getByRole('tab', {name: tab.label});
      expect(within(tabEl).getByRole('link', {hidden: true})).toHaveAttribute(
        'href',
        '/some-link'
      );
    });

    // Command/ctrl/shift-clicking on a tab link doesn't change the tab selection.
    // The expected behavior is that clicking on a tab link will open a new browser
    // tab/window. The current view shouldn't update.
    const secondTabEl = screen.getByRole('tab', {name: TABS[1].label});
    const secondTabLink = within(secondTabEl).getByRole('link', {hidden: true});
    userEvent.click(secondTabLink, {metaKey: true});
    userEvent.click(secondTabLink, {ctrlKey: true});
    userEvent.click(secondTabLink, {shiftKey: true});
    expect(screen.getByRole('tab', {name: TABS[0].label})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
