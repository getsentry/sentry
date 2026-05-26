import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CurrencyCell} from './currencyCell';

describe('CurrencyCell', () => {
  it('renders em dash for null values', () => {
    render(<CurrencyCell value={null} />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('renders formatted dollar value', () => {
    render(<CurrencyCell value={17.5} />);
    expect(screen.getByText('$17.5')).toBeInTheDocument();
  });

  it('renders less than $0.01 for small positive values', () => {
    render(<CurrencyCell value={0.005} />);
    expect(screen.getByText(/^<\$/)).toBeInTheDocument();
  });

  it('renders $0 for zero value', () => {
    render(<CurrencyCell value={0} />);
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('renders negative value with warning icon', async () => {
    render(<CurrencyCell value={-5.5} />);

    // The negative value should be rendered
    expect(screen.getByText('$-5.5')).toBeInTheDocument();

    // Warning icon should be present
    const warningIcon = screen.getByRole('img', {hidden: true});
    expect(warningIcon).toBeInTheDocument();

    // Hover over the wrapper to see tooltip
    await userEvent.hover(warningIcon);
    expect(
      await screen.findByText(/Negative costs indicate an error/)
    ).toBeInTheDocument();
    expect(screen.getByText('Follow this guide')).toBeInTheDocument();
  });
});
