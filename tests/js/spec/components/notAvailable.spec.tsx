import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import NotAvailable from 'sentry/components/notAvailable';

describe('NotAvailable', function () {
  it('renders', function () {
    mountWithTheme(<NotAvailable />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('renders with tooltip', function () {
    jest.useFakeTimers();
    mountWithTheme(<NotAvailable tooltip="Tooltip text" />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();

    userEvent.hover(screen.getByText('\u2014'));
    jest.advanceTimersByTime(50);

    expect(screen.getByText('Tooltip text')).toBeInTheDocument();
  });
});
