import type {ContainerBreakpointSize} from 'sentry/utils/theme';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const SNAPSHOT_THEMES = ['light', 'dark'] as const;
const THEMES = {light: lightTheme, dark: darkTheme};

export const DEFAULT_SNAPSHOT_CONTAINERS = ['3xl'] as const;

export type SnapshotTheme = (typeof SNAPSHOT_THEMES)[number];
type SnapshotContainer = Exclude<ContainerBreakpointSize, 'zero'>;
export type SnapshotContainers = readonly [SnapshotContainer, ...SnapshotContainer[]];

export interface SnapshotRenderContext {
  container: SnapshotContainer;
  containerWidth: number;
  theme: SnapshotTheme;
}

export interface SnapshotScenario extends SnapshotRenderContext {
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
      containerWidth: parseInt(THEMES[theme].container[container], 10),
      testName: `${theme} snapshot: ${name}${includeContainerSuffix ? ` @container-${container}` : ''}${viewportSuffix}`,
    }))
  );
}
