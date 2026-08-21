import type {Theme} from '@emotion/react';

import {getLogSeverityLevel, SeverityLevel} from 'sentry/views/explore/logs/utils';

import type {SessionEvent} from './useSessionDetail';

/**
 * How an item is colored: `muted` unless it is carrying something worth
 * interrupting for.
 */
export type SeverityVariant = 'danger' | 'warning' | 'muted';

/**
 * Log levels worth a color, and which one. Everything quieter stays muted, so red
 * in the rail keeps meaning "something went wrong" rather than "this row is a
 * log" — and a fatal log stops looking like a trace-level one, which is what
 * happens when a whole dataset takes a single hue.
 *
 * The variants match the logs explorer's own severity colors, so a level reads
 * the same here as it does there.
 */
const LOUD_LOG_LEVELS: Partial<Record<SeverityLevel, SeverityVariant>> = {
  [SeverityLevel.FATAL]: 'danger',
  [SeverityLevel.ERROR]: 'danger',
  [SeverityLevel.WARN]: 'warning',
};

/**
 * How bad an item is, which is the only thing the rail spends color on. The type
 * is said by the item's icon instead, which leaves severity a hue of its own: on a
 * screen of muted rows, the red ones are the answer to "what happened here".
 *
 * Errors are always danger — an error event is a problem whatever its `level`
 * says. Traces and metrics have no severity to report, and logs carry theirs in a
 * field.
 */
export function severityVariant(event: SessionEvent): SeverityVariant {
  if (event.key === 'errors') {
    return 'danger';
  }
  if (event.key !== 'logs') {
    return 'muted';
  }
  const severity = typeof event.row.severity === 'string' ? event.row.severity : null;
  return LOUD_LOG_LEVELS[getLogSeverityLevel(null, severity)] ?? 'muted';
}

/** The shape color for a variant: `graphics` for drawn things, not for text. */
export function graphicsColor(variant: SeverityVariant, theme: Theme): string {
  return theme.tokens.graphics[variant === 'muted' ? 'neutral' : variant].vibrant;
}
