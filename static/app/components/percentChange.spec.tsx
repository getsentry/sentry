import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PercentChange} from 'sentry/components/percentChange';

describe('PercentChange', function () {
  it('renders negative percent change', () => {
    render(<PercentChange value={-0.2352} />);

    expect(screen.getByText('-23.52%')).toBeInTheDocument();
  });

  it('renders positive percent change', () => {
    render(<PercentChange value={0.0552} />);

    expect(screen.getByText('+5.52%')).toBeInTheDocument();
  });

  it('respects preferred negative polarity', () => {
    render(<PercentChange value={0.0552} preferredPolarity="-" />);

    expect(screen.getByText('+5.52%')).toHaveAttribute('data-rating', 'bad');
  });

  it('respects preferred positive polarity', () => {
    render(<PercentChange value={0.0552} preferredPolarity="+" />);

    expect(screen.getByText('+5.52%')).toHaveAttribute('data-rating', 'good');
  });
});
