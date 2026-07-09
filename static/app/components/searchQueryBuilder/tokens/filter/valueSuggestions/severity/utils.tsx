const SEVERITY_FILTER_KEYS = new Set(['level', 'severity']);

export function isSeverityFilterKey(key: string): boolean {
  return SEVERITY_FILTER_KEYS.has(key);
}

export function getSeverityColorVariant(value: string) {
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
    default:
      return 'muted';
  }
}
