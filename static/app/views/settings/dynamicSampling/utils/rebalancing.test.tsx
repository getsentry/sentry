import {balanceSampleRate} from './rebalancing';

describe('balanceSampleRate', () => {
  it('balances sample rates evenly when counts are equal', () => {
    const items = [
      {id: '1', count: 1000, sampleRate: 0.1},
      {id: '2', count: 1000, sampleRate: 0.1},
    ];

    const {balancedItems, usedBudget} = balanceSampleRate({
      items,
      targetSampleRate: 0.2,
    });

    expect(balancedItems).toHaveLength(2);
    expect(balancedItems[0]!.sampleRate).toBeCloseTo(0.2);
    expect(balancedItems[1]!.sampleRate).toBeCloseTo(0.2);
    expect(usedBudget).toBeCloseTo(400);
  });

  it('distributes budget to lower count items first', () => {
    const items = [
      {id: '1', count: 2000, sampleRate: 0.1},
      {id: '2', count: 1000, sampleRate: 0.1},
    ];

    const {balancedItems, usedBudget} = balanceSampleRate({
      items,
      targetSampleRate: 0.2,
    });

    // Items should be sorted by count, so id:2 should be first
    expect(balancedItems[0]!.id).toBe('2');
    expect(balancedItems[1]!.id).toBe('1');

    // Lower count item should get higher sample rate
    expect(balancedItems[0]!.sampleRate).toBeGreaterThan(balancedItems[1]!.sampleRate);
    expect(usedBudget).toBeCloseTo(600);
  });

  it('respects minBudget parameter', () => {
    const items = [
      {id: '1', count: 1000, sampleRate: 0.1},
      {id: '2', count: 1000, sampleRate: 0.1},
    ];

    const {balancedItems, usedBudget} = balanceSampleRate({
      items,
      targetSampleRate: 0.2,
      minBudget: 500,
    });

    expect(usedBudget).toBeGreaterThanOrEqual(500);
    expect(balancedItems[0]!.sampleRate).toBeGreaterThan(0.2);
    expect(balancedItems[1]!.sampleRate).toBeGreaterThan(0.2);
  });

  it('caps sample rate at 1.0', () => {
    const items = [
      {id: '1', count: 100, sampleRate: 0.1},
      {id: '2', count: 10000, sampleRate: 0.1},
    ];

    const {balancedItems} = balanceSampleRate({
      items,
      targetSampleRate: 0.8,
    });

    expect(balancedItems[0]!.sampleRate).toBe(1.0); // Small count item should be capped at 1.0
    expect(balancedItems[1]!.sampleRate).toBeLessThan(1.0);
  });

  it('handles empty items array', () => {
    const {balancedItems, usedBudget} = balanceSampleRate({
      items: [],
      targetSampleRate: 0.2,
    });

    expect(balancedItems).toHaveLength(0);
    expect(usedBudget).toBe(0);
  });
});
