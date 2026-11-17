import {groupCostByProduct} from './utils';

function costGroup(feature: string, costUsd: number[]) {
  return {
    by: {feature, category: 'billable_seer_credits'},
    series: {costUsd},
    totals: {costUsd: costUsd.reduce((sum, cost) => sum + cost, 0)},
  };
}

describe('groupCostByProduct', () => {
  it('sums the cost of each feature into its product', () => {
    const products = groupCostByProduct({
      start: '2026-11-01T00:00:00Z',
      end: '2026-11-03T00:00:00Z',
      intervals: ['2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'],
      groups: [
        costGroup('some_new_feature', [0.5, 0]),
        costGroup('seer_agent_slack', [0, 0.25]),
        costGroup('autofix_web', [1, 2]),
        costGroup('autofix_post_process', [0.125, 0]),
        costGroup('seer_agent', [4, 0]),
      ],
    });

    expect(products).toEqual([
      {label: 'Autofix', costUsd: [1.125, 2], totalUsd: 3.125},
      {label: 'Seer Agent', costUsd: [4, 0.25], totalUsd: 4.25},
      {label: 'Other', costUsd: [0.5, 0], totalUsd: 0.5},
    ]);
  });

  it('does not match features that only share a prefix with a product', () => {
    const products = groupCostByProduct({
      start: '2026-11-01T00:00:00Z',
      end: '2026-11-02T00:00:00Z',
      intervals: ['2026-11-01T00:00:00Z'],
      groups: [costGroup('autofixer', [1])],
    });

    expect(products).toEqual([{label: 'Other', costUsd: [1], totalUsd: 1}]);
  });
});
