interface ScalingItem {
  count: number;
  sampleRate: number;
}

/**
 * Scales the sample rates of items proportionally to their current sample rate.
 */
export function scaleSampleRates<T extends ScalingItem>({
  items,
  sampleRate,
}: {
  items: T[];
  sampleRate: number;
}): {
  scaledItems: T[];
} {
  const totalSpans = items.reduce((acc, item) => acc + item.count, 0);
  const oldSampleRate = items.reduce(
    (acc, item) => acc + item.sampleRate * (item.count / totalSpans),
    0
  );

  if (sampleRate === oldSampleRate) {
    return {scaledItems: items};
  }

  if (
    oldSampleRate === 0 ||
    oldSampleRate === 1 ||
    sampleRate === 0 ||
    sampleRate === 1
  ) {
    return {
      scaledItems: items.map(item => ({
        ...item,
        sampleRate,
      })),
    };
  }

  const newSampled = totalSpans * sampleRate;

  let factor = sampleRate / oldSampleRate;
  let remainingTotal = totalSpans;
  let remainingSampleCount = newSampled;
  let remainingOldSampleCount = totalSpans * oldSampleRate;

  const sortedItems = items.toSorted((a, b) => a.count - b.count);

  const scaledItems: T[] = [];
  for (const item of sortedItems) {
    const newProjectRate = Math.min(1, Math.max(0, item.sampleRate * factor));
    const newProjectSampleCount = item.count * newProjectRate;

    remainingTotal -= item.count;
    remainingSampleCount -= newProjectSampleCount;
    remainingOldSampleCount -= item.count * item.sampleRate;

    const newTargetRate = remainingSampleCount / remainingTotal;

    const remainingTotalRef = remainingTotal;
    const remainingOldSampleRate = remainingOldSampleCount / remainingTotalRef;

    factor = newTargetRate / remainingOldSampleRate;

    scaledItems.push({
      ...item,
      sampleRate: newProjectRate,
    });
  }
  return {scaledItems};
}
