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

  it('renders negative value with warning tooltip', async () => {
    render(<CurrencyCell value={-5.5} />);

    // The negative value should be rendered
    expect(screen.getByText('$-5.5')).toBeInTheDocument();

    // Hover over the value to see tooltip
    await userEvent.hover(screen.getByText('$-5.5'));
    expect(
      await screen.findByText(/Negative costs indicate an error/)
    ).toBeInTheDocument();
    expect(screen.getByText('Follow this guide')).toBeInTheDocument();
  });
});
