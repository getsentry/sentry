import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AlertHeader} from 'sentry/views/alerts/list/header';

describe('AlertHeader', () => {
  it('renders header actions in TopBar.Slot', () => {
    render(<AlertHeader activeTab="stream" />);
    expect(screen.getByRole('button', {name: 'Settings'})).toBeInTheDocument();
  });

  it('renders tabs with correct links', () => {
    render(<AlertHeader activeTab="stream" />);
    expect(screen.getByRole('tab', {name: 'Alert Rules'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'History'})).toBeInTheDocument();
  });
});
