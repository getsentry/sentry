const format = (v: number, abbrev: string, precision: number) => {
  if (v === 0) {
    return '0' + abbrev;
  }
  return v.toFixed(precision) + abbrev;
};

// We avoid the moment date formatter as it creates a lot of intermediary strings,
// which the trace view is already doing a lot of, so we try to avoid it here as
// gc during scrolling causes jank
export function formatTraceDuration(duration_ms: number) {
  if (duration_ms >= 24 * 60 * 60 * 1e3) {
    return format((duration_ms / 24) * 60 * 60e3, 'd', 2);
  }
  if (duration_ms >= 60 * 60 * 1e3) {
    return format((duration_ms / 60) * 60e3, 'h', 2);
  }
  if (duration_ms >= 60 * 1e3) {
    return format(duration_ms / 60e3, 'min', 2);
  }
  if (duration_ms >= 1e3) {
    return format(duration_ms / 1e3, 's', 2);
  }
  return format(duration_ms, 'ms', 2);
}
