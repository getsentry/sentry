import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {TagVariant} from 'sentry/utils/theme/types';

export function statusToTagVariant(status: string): TagVariant {
  switch (status) {
    case 'review_completed':
      return 'success';
    case 'review_failed':
      return 'danger';
    case 'preflight_denied':
    case 'webhook_filtered':
      return 'warning';
    case 'sent_to_seer':
    case 'review_started':
      return 'info';
    default:
      return 'muted';
  }
}

export function prStateToTagVariant(state: string | null): TagVariant {
  switch (state) {
    case 'open':
      return 'success';
    case 'merged':
      return 'info';
    case 'closed':
      return 'danger';
    default:
      return 'muted';
  }
}

export function formatStatus(status: string): string {
  return toTitleCase(status.replace(/_/g, ' '));
}

/** e.g. 1500 -> "2s", 65000 -> "1m 5s", 3600000 -> "1h 0m" */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
