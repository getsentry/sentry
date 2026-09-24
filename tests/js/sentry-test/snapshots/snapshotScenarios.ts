import type {Organization} from 'sentry/types/organization';
import type {ContainerBreakpointSize} from 'sentry/utils/theme';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const SNAPSHOT_THEMES = ['light', 'dark'] as const;
const THEMES = {light: lightTheme, dark: darkTheme};

export const DEFAULT_SNAPSHOT_CONTAINERS = ['3xl'] as const;

type SnapshotTheme = (typeof SNAPSHOT_THEMES)[number];
type SnapshotContainer = Exclude<ContainerBreakpointSize, 'zero'>;
export type SnapshotContainers = readonly [SnapshotContainer, ...SnapshotContainer[]];

export interface SnapshotRenderContext {
  container: SnapshotContainer;
  containerWidth: number;
  features: Organization['features'];
  theme: SnapshotTheme;
}

export interface SnapshotScenario extends SnapshotRenderContext {
  testName: string;
}

export function normalizeSnapshotFeatures(
  features: Organization['features'] = []
): Organization['features'] {
  return [...new Set(features)].sort();
}

export function getSnapshotFeaturesTag(
  features: Organization['features']
): string | undefined {
  return features.length > 0 ? features.join(',') : undefined;
}

export function expandSnapshotScenarios(
  name: string,
  containers: SnapshotContainers = DEFAULT_SNAPSHOT_CONTAINERS,
  viewportLabel?: string,
  features?: Organization['features']
): SnapshotScenario[] {
  const viewportSuffix = viewportLabel ? ` @${viewportLabel}` : '';
  const includeContainerSuffix = containers.length > 1;
  const normalizedFeatures = normalizeSnapshotFeatures(features);

  return SNAPSHOT_THEMES.flatMap(theme =>
    containers.map(container => ({
      theme,
      container,
      containerWidth: parseInt(THEMES[theme].container[container], 10),
      features: normalizedFeatures,
      testName: `${theme} snapshot: ${name}${includeContainerSuffix ? ` @container-${container}` : ''}${viewportSuffix}`,
    }))
  );
}
