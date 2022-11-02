import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Item, TabList, TabPanels, Tabs} from 'sentry/components/tabs';

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
            <Item key={tab.key}>{tab.label}</Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <Item key={tab.key}>{tab.content}</Item>
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
            <Item key={tab.key}>{tab.label}</Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <Item key={tab.key}>{tab.content}</Item>
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
            <Item key={tab.key}>{tab.label}</Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <Item key={tab.key}>{tab.content}</Item>
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

  it('changes tabs on key press', () => {
    render(
      <Tabs>
        <TabList>
          {TABS.map(tab => (
            <Item key={tab.key}>{tab.label}</Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <Item key={tab.key}>{tab.content}</Item>
          ))}
        </TabPanels>
      </Tabs>
    );

    // Focus on tab list
    userEvent.tab();
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveFocus();

    // Press Arrow Right to select the next tab to the right (Activity)
    userEvent.keyboard('{arrowRight}');

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
            <Item key={tab.key}>{tab.label}</Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <Item key={tab.key}>{tab.content}</Item>
          ))}
        </TabPanels>
      </Tabs>
    );

    // Focus on tab list
    userEvent.tab();
    expect(screen.getByRole('tab', {name: 'Details'})).toHaveFocus();

    // Press Arrow Right to select the next tab below (Activity)
    userEvent.keyboard('{arrowDown}');

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
            <Item key={tab.key} disabled>
              {tab.label}
            </Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <Item key={tab.key}>{tab.content}</Item>
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
});
