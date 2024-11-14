import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import NotAvailable from 'sentry/components/notAvailable';

describe('NotAvailable', function () {
  it('renders', function () {
    render(<NotAvailable />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('renders with tooltip', async function () {
    render(<NotAvailable tooltip="Tooltip text" />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('\u2014'));

    expect(await screen.findByText('Tooltip text')).toBeInTheDocument();
  });
});
