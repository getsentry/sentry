import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DraggableTabBar} from 'sentry/components/draggableTabs';

const TABS = [
  {key: 'one', label: 'Tab One', content: 'So by colonel hearted ferrars.'},
  {
    key: 'two',
    label: 'Tab Two',
    content: 'This is tab two',
  },
  {
    key: 'three',
    label: 'Tab Three',
    content: 'Is inquiry no he several excited am.',
  },
  {
    key: 'four',
    label: 'Tab Four',
    content: 'Called though excuse length ye needed it he having.',
  },
];

describe('DraggableTabs', () => {
  it('renders draggable tabs list', () => {
    render(<DraggableTabBar tabs={TABS} />);

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

  it('changes tabs using keyboard navigation', async () => {
    render(<DraggableTabBar tabs={TABS} />);

    // Focus on tab list
    await userEvent.tab();
    expect(screen.getByRole('tab', {name: 'Tab One'})).toHaveFocus();

    // Press Arrow Right to select the next tab to the right (Tab Two)
    await userEvent.keyboard('{arrowRight}{enter}');

    // The Second tab is selected and its contents rendered
    expect(screen.getByRole('tab', {name: 'Tab Two'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(TABS[1].content)).toBeInTheDocument();
  });
});
