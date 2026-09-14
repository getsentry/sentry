import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TokenBreakdownTooltip} from './tokenBreakdownTooltip';

describe('TokenBreakdownTooltip', () => {
  it('shows nested complements only when subcategories exist', () => {
    const {rerender} = render(
      <TokenBreakdownTooltip
        breakdowns={[
          {
            cacheRead: 20,
            cacheWrite: 10,
            input: 100,
            isComplete: true,
            output: 50,
            reasoning: 5,
            total: 150,
          },
        ]}
      />
    );

    expect(screen.getByText('Non-cached')).toBeInTheDocument();
    expect(screen.getByText('Non-reasoning')).toBeInTheDocument();

    rerender(
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
    expect(screen.queryByText('Non-reasoning')).not.toBeInTheDocument();
  });
});
