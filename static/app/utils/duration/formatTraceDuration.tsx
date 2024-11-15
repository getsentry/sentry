const format = (v: number, abbrev: string, precision: number) => {
  if (v === 0) {
    return '0' + abbrev;
  }
  return v.toFixed(precision) + abbrev;
};

// We avoid the moment date formatter as it creates a lot of intermediary strings,
// which the trace view is already doing a lot of, so we try to avoid it here as
// gc during scrolling causes jank
export function formatTraceDuration(duration_ms: number, precision: number = 2) {
  if (duration_ms <= 0) {
    return '0ms';
  }
  if (duration_ms < 1000) {
    return format(duration_ms, 'ms', precision);
  }
  if (duration_ms < 60000) {
    return format(duration_ms / 1000, 's', precision);
  }
  if (duration_ms < 3600000) {
    return format(duration_ms / 60000, 'm', precision);
  }
  if (duration_ms < 86400000) {
    return format(duration_ms / 3600000, 'h', precision);
  }
  return format(duration_ms / 86400000, 'd', precision);
}
