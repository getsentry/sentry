import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const SNAPSHOT_THEMES = ['light', 'dark'] as const;
const THEMES = {light: lightTheme, dark: darkTheme};

export const DEFAULT_SNAPSHOT_CONTAINERS = ['4xl'] as const;

export type SnapshotTheme = (typeof SNAPSHOT_THEMES)[number];
type SnapshotContainer = keyof typeof lightTheme.size;
export type SnapshotContainers = readonly [SnapshotContainer, ...SnapshotContainer[]];

export interface SnapshotRenderContext {
  container: SnapshotContainer;
  theme: SnapshotTheme;
}

export interface SnapshotScenario extends SnapshotRenderContext {
  containerWidth: number;
  testName: string;
}

export function expandSnapshotScenarios(
  name: string,
  containers: SnapshotContainers = DEFAULT_SNAPSHOT_CONTAINERS,
  viewportLabel?: string
): SnapshotScenario[] {
  const viewportSuffix = viewportLabel ? ` @${viewportLabel}` : '';
  const includeContainerSuffix = containers.length > 1;

  return SNAPSHOT_THEMES.flatMap(theme =>
    containers.map(container => ({
      theme,
      container,
      containerWidth: parseInt(THEMES[theme].size[container], 10),
      testName: `${theme} snapshot: ${name}${includeContainerSuffix ? ` @${container}` : ''}${viewportSuffix}`,
    }))
  );
}
