import type {Theme} from '@emotion/react';

export function withAlpha(color: string, alpha: number): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color.slice(0, 7)}${channel}`.toUpperCase();
}

const SEVERITY_THRESHOLDS = [0, 0.05, 0.1, 0.25, 0.5] as const;

export function severityColor(ratio: number, theme: Theme): string {
  if (ratio <= 0) {
    return withAlpha(theme.tokens.background.secondary, 1);
  }

  const scale = theme.tokens.dataviz.sequential.magma.series5;
  const step = SEVERITY_THRESHOLDS.findLastIndex(threshold => ratio >= threshold);
  return withAlpha(scale[step]!, 1);
}
