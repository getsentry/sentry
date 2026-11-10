import type {Theme} from '@emotion/react';

export type OutcomeColors = Record<string, string>;

export function getOutcomeColors(outcomes: string[], theme: Theme): OutcomeColors {
  const orderedOutcomes = [...new Set(outcomes)].sort();
  const palette = theme.chart.getColorPalette(Math.max(orderedOutcomes.length - 1, 0));

  return orderedOutcomes.reduce<OutcomeColors>((acc, outcome, index) => {
    acc[outcome] = palette[index % palette.length]!;
    return acc;
  }, {});
}

export type OutcomeSelection = Record<string, boolean>;

export function isOutcomeSelected(selection: OutcomeSelection, outcome: string): boolean {
  return selection[outcome] !== false;
}
