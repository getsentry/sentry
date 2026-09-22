export function formatInvestigationDuration(seconds: number): string {
  const tenths = Math.floor(seconds * 10);
  if (tenths < 600) {
    return `${(tenths / 10).toFixed(1)} s`;
  }
  const wholeSeconds = Math.floor(tenths / 10);
  return `${Math.floor(wholeSeconds / 60)}m ${wholeSeconds % 60}s`;
}
