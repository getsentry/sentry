import {useCallback, useMemo, useState} from 'react';

import {
  DROPPED_DATA_LAYER,
  useDroppedDataLayer,
} from 'sentry/components/droppedData/useDroppedDataLayer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {defined} from 'sentry/utils/defined';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AnnotationItem} from './annotations/types';
import {useAnnotationItems} from './annotations/useAnnotationItems';
import {annotationContextTab} from './contextDrawer/chartContextDrawer';
import type {ChartLayer, ChartLayersControlProps} from './chartLayersControl';

const RELEASES_LAYER = 'releases';
const FLAGS_LAYER = 'flags';

interface UseChartLayersParams {
  dataset: DiscoverDatasets;
  interval: string;
  source: DroppedDataAnalyticsSource;
  enabled?: boolean;
  hidden?: boolean;
}

/**
 * The context layers drawn on a time series chart, and the single Layers
 * control that toggles them.
 */
export function useChartLayers({
  dataset,
  interval,
  source,
  enabled = true,
  hidden = false,
}: UseChartLayersParams) {
  const organization = useOrganization();
  const areAnnotationsEnabled =
    enabled && organization.features.includes('timeseries-annotations');
  const droppedData = useDroppedDataLayer(
    {dataset, interval},
    {source, enabled, hidden, showAnnotationTabs: areAnnotationsEnabled}
  );

  const {release: releaseItems, flag: flagItems} = useAnnotationItems({
    enabled: areAnnotationsEnabled,
  });

  const [isReleasesLayerOn, setIsReleasesLayerOn] = useState(true);
  const hasReleases = (releaseItems?.length ?? 0) > 0;
  const areReleasesShown = hasReleases && isReleasesLayerOn && !hidden;

  const [isFlagsLayerOn, setIsFlagsLayerOn] = useState(true);
  const hasFlags = (flagItems?.length ?? 0) > 0;
  const areFlagsShown = hasFlags && isFlagsLayerOn && !hidden;

  const annotations = useMemo(() => {
    const items: AnnotationItem[] = [
      ...(areReleasesShown ? (releaseItems ?? []) : []),
      ...(areFlagsShown ? (flagItems ?? []) : []),
    ];
    return items.length > 0 ? items : undefined;
  }, [areReleasesShown, releaseItems, areFlagsShown, flagItems]);

  const releasesLayer: ChartLayer | undefined =
    areAnnotationsEnabled && defined(releaseItems)
      ? {
          value: RELEASES_LAYER,
          label: t('Releases'),
          selected: hasReleases && isReleasesLayerOn,
          disabled: !hasReleases,
          tooltip: hasReleases ? undefined : t('No releases in this time range'),
        }
      : undefined;

  const flagsLayer: ChartLayer | undefined =
    areAnnotationsEnabled && defined(flagItems)
      ? {
          value: FLAGS_LAYER,
          label: t('Flags'),
          selected: hasFlags && isFlagsLayerOn,
          disabled: !hasFlags,
          tooltip: hasFlags ? undefined : t('No flag changes in this time range'),
        }
      : undefined;

  const layers = [
    ...(droppedData.layerControl?.layers ?? []),
    releasesLayer,
    flagsLayer,
  ].filter(defined);

  function onLayerChange(value: string, selected: boolean) {
    if (value === DROPPED_DATA_LAYER) {
      droppedData.layerControl?.onChange(value, selected);
    } else if (value === RELEASES_LAYER) {
      setIsReleasesLayerOn(selected);
      trackAnalytics('releases.bubbles_legend', {organization, selected});
    } else if (value === FLAGS_LAYER) {
      setIsFlagsLayerOn(selected);
      trackAnalytics('flags.layer_toggled', {organization, selected});
    }
  }

  const layerControl: ChartLayersControlProps | undefined =
    layers.length > 0 ? {layers, onChange: onLayerChange} : undefined;

  const {openContextDrawer} = droppedData;
  const onAnnotationClick = useCallback(
    (items: AnnotationItem[]) => {
      const tab = annotationContextTab(items);
      if (tab) {
        openContextDrawer(tab);
      }
    },
    [openContextDrawer]
  );

  return {droppedData, annotations, layerControl, onAnnotationClick};
}
