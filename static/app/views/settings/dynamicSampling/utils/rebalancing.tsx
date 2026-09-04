interface BalancingItem {
  count: number;
  id: string;
  sampleRate: number;
}

interface Params<T extends BalancingItem> {
  items: T[];
  targetSampleRate: number;
}

/**
 * Balances the sample rate of items to match the target sample rate.
 * Mirrors the behavior of the dynamic sampling backend.
 *
 * See `src/sentry/dynamic_sampling/models/projects_rebalancing.py`
 * and `src/sentry/dynamic_sampling/models/full_rebalancing.py`
 *
 * @param targetSampleRate The target sample rate to balance the items to.
 * @param items The items to balance.
 * @returns The balanced items and the used budget.
 */
export function balanceSampleRate<T extends BalancingItem>({
  targetSampleRate,
  items,
}: Params<T>): {
  balancedItems: T[];
  usedBudget: number;
} {
  // Sort the items ascending by count, so the available budget is distributed to the items with the lowest count first
  const sortedItems = items.toSorted((a, b) => a.count - b.count);
  const total = items.reduce((acc, item) => acc + item.count, 0);

  let numItems = items.length;
  let ideal = (total * targetSampleRate) / numItems;
  let minBudget = Math.min(total, total * targetSampleRate);
  let usedBudget = 0;

  const balancedItems: T[] = [];
  for (const item of sortedItems) {
    const count = item.count;
    let newSampleRate = 0;
    let used = 0;

    if (ideal * numItems < minBudget) {
      // If we keep to our ideal we will not be able to use the minimum budget (readjust our target)
      ideal = minBudget / numItems;
    }

    const sampled = count * targetSampleRate;
    const delta = ideal - sampled;
    const correction = delta;
    const desiredCount = sampled + correction;

    if (desiredCount > count) {
      // We desire more than we have, so we give it all
      newSampleRate = 1;
      used = count;
    } else {
      newSampleRate = desiredCount / count;
      used = desiredCount;
    }

    usedBudget += used;
    minBudget -= used;
    numItems -= 1;
    balancedItems.push({
      ...item,
      sampleRate: newSampleRate,
    });
  }

  return {balancedItems, usedBudget};
}
