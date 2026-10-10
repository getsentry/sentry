/**
 * Formats elapsed ms as "5.3s" under a minute, else "1m 30s" or "1h 2m 3s".
 */
export function formatElapsedDuration(ms: number): string {
  const tenths = Math.floor(ms / 100);
  if (tenths < 600) {
    return `${(tenths / 10).toFixed(1)}s`;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
}
