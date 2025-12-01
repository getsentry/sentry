export function calculateAttrubutePopulationPercentage(
  values: Array<{
    label: string;
    value: number;
  }>,
  cohortTotal: number
): number {
  if (cohortTotal === 0) return 0;

  const populatedCount = values.reduce((acc, curr) => acc + curr.value, 0);
  return (populatedCount / cohortTotal) * 100;
}

export function percentageFormatter(percentage: number): string {
  if (isNaN(percentage) || !isFinite(percentage)) {
    return '\u2014';
  }

  if (percentage < 0.1 && percentage > 0) {
    return '<0.1%';
  }

  // Round to whole number if we round to a whole number, else use 1 decimal place
  const rounded = percentage.toFixed(1);
  const roundsToWhole = rounded.endsWith('.0') || !rounded.includes('.');

  const decimals = roundsToWhole ? 0 : 1;
  return `${percentage.toFixed(decimals)}%`;
}
