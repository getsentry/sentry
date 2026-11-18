import {groupCreditsByProduct} from './utils';

function creditsGroup(feature: string, credits: number[]) {
  return {
    by: {feature, category: 'billable_seer_credits'},
    series: {credits},
    totals: {credits: credits.reduce((sum, value) => sum + value, 0)},
  };
}

describe('groupCreditsByProduct', () => {
  it('sums the credits of each feature into its product', () => {
    const products = groupCreditsByProduct({
      start: '2026-11-01T00:00:00Z',
      end: '2026-11-03T00:00:00Z',
      intervals: ['2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'],
      groups: [
        creditsGroup('some_new_feature', [50, 0]),
        creditsGroup('seer_agent_slack', [0, 25]),
        creditsGroup('autofix_web', [100, 200]),
        creditsGroup('autofix_post_process', [12.5, 0]),
        creditsGroup('seer_agent', [400, 0]),
      ],
    });

    expect(products).toEqual([
      {label: 'Autofix', credits: [112.5, 200], totalCredits: 312.5},
      {label: 'Agent', credits: [400, 25], totalCredits: 425},
      {label: 'Other', credits: [50, 0], totalCredits: 50},
    ]);
  });

  it('does not match features that only share a prefix with a product', () => {
    const products = groupCreditsByProduct({
      start: '2026-11-01T00:00:00Z',
      end: '2026-11-02T00:00:00Z',
      intervals: ['2026-11-01T00:00:00Z'],
      groups: [creditsGroup('autofixer', [100])],
    });

    expect(products).toEqual([{label: 'Other', credits: [100], totalCredits: 100}]);
  });
});
