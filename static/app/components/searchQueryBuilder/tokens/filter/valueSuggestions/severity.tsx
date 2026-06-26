import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

/**
 * Filter keys whose values are severity levels and should render a colored
 * indicator next to each suggestion: the logs `severity` attribute and the
 * event `level` field. The color mapping mirrors the severity coloring used in
 * the logs table (see `getLogColors` in the logs views) so the search dropdown
 * stays visually consistent with the data it filters.
 */
const SEVERITY_FILTER_KEYS = new Set(['severity', 'level']);

export function isSeverityFilterKey(key: string): boolean {
  return SEVERITY_FILTER_KEYS.has(key);
}

type SeverityColorVariant = 'danger' | 'warning' | 'accent' | 'neutral';

export function getSeverityColorVariant(value: string): SeverityColorVariant {
  switch (value.trim().toUpperCase()) {
    case 'ERROR':
    case 'FATAL':
      return 'danger';
    case 'WARN':
    case 'WARNING':
      return 'warning';
    case 'INFO':
    case 'TRACE':
    case 'SAMPLE':
      return 'accent';
    case 'DEBUG':
    case 'DEFAULT':
    default:
      return 'neutral';
  }
}

function getDotColor(variant: SeverityColorVariant, theme: Theme): string {
  switch (variant) {
    case 'danger':
      return theme.tokens.graphics.danger.vibrant;
    case 'warning':
      return theme.tokens.graphics.warning.vibrant;
    case 'accent':
      return theme.tokens.graphics.accent.vibrant;
    case 'neutral':
      return theme.tokens.graphics.neutral.vibrant;
  }
}

const SeverityDot = styled('span')<{variant: SeverityColorVariant}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => getDotColor(p.variant, p.theme)};
`;

export function SeverityValueIndicator({value}: {value: string}) {
  return (
    <SeverityDot
      variant={getSeverityColorVariant(value)}
      data-test-id="severity-indicator"
      aria-hidden
    />
  );
}
