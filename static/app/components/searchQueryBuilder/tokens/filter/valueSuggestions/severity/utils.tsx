const SEVERITY_FILTER_KEYS = new Set(['level', 'severity']);

export function isSeverityFilterKey(key: string): boolean {
  return SEVERITY_FILTER_KEYS.has(key);
}

export type SeverityColorVariant = 'danger' | 'warning' | 'accent' | 'neutral';

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
