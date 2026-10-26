const SNAPSHOT_THEMES = ['light', 'dark'] as const;

export type SnapshotTheme = (typeof SNAPSHOT_THEMES)[number];

interface SnapshotScenario {
  testName: string;
  theme: SnapshotTheme;
}

export function expandSnapshotScenarios(
  name: string,
  viewportLabel?: string
): SnapshotScenario[] {
  const viewportSuffix = viewportLabel ? ` @${viewportLabel}` : '';
  return SNAPSHOT_THEMES.map(theme => ({
    theme,
    testName: `${theme} snapshot: ${name}${viewportSuffix}`,
  }));
}
