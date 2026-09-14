import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TokenBreakdownTooltip} from './tokenBreakdownTooltip';

describe('TokenBreakdownTooltip', () => {
  it('shows input and output subcategories with their complements', () => {
    render(
      <TokenBreakdownTooltip
        breakdowns={[
          {
            cacheRead: 20,
            cacheWrite: 10,
            input: 100,
            isComplete: true,
            model: 'claude-test',
            output: 50,
            reasoning: 5,
            total: 150,
          },
        ]}
      />
    );

    expect(screen.getByText('claude-test')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('caps reasoning tokens at the output total', () => {
    render(
      <TokenBreakdownTooltip
        breakdowns={[
          {
            cacheRead: 0,
            cacheWrite: 0,
            input: 40,
            isComplete: true,
            output: 10,
            reasoning: 30,
            total: 50,
          },
        ]}
      />
    );

    expect(screen.getByText('Non-reasoning').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText('Reasoning').nextElementSibling).toHaveTextContent('10');
  });

  it('omits subcategories that have no tokens', () => {
    render(
      <TokenBreakdownTooltip
        breakdowns={[
          {
            cacheRead: 0,
            cacheWrite: 0,
            input: 100,
            isComplete: true,
            output: 50,
            reasoning: 0,
            total: 150,
          },
        ]}
      />
    );

    expect(screen.queryByText('Non-cached')).not.toBeInTheDocument();
    expect(screen.queryByText('Cache Read')).not.toBeInTheDocument();
    expect(screen.queryByText('Cache Write')).not.toBeInTheDocument();
    expect(screen.queryByText('Non-reasoning')).not.toBeInTheDocument();
    expect(screen.queryByText('Reasoning')).not.toBeInTheDocument();
  });

  it('shows only the reported total for an incomplete breakdown', () => {
    render(
      <TokenBreakdownTooltip
        breakdowns={[
          {
            cacheRead: 0,
            cacheWrite: 0,
            input: 100,
            isComplete: false,
            output: 0,
            reasoning: 0,
            total: 150,
          },
        ]}
      />
    );

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.queryByText('Input')).not.toBeInTheDocument();
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });
});
