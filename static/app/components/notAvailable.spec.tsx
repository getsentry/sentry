import {render, screen} from 'sentry-test/reactTestingLibrary';

import {NotAvailable} from './notAvailable';

describe('NotAvailable', () => {
  it('renders', () => {
    render(<NotAvailable />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });
});
