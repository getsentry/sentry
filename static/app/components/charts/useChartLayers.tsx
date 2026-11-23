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

import type {AnnotationItem, AnnotationKind} from './annotations/types';
import {useAnnotationItems} from './annotations/useAnnotationItems';
import type {ChartLayer, ChartLayersControlProps} from './chartLayersControl';

const RELEASES_LAYER = 'releases';
const FLAGS_LAYER = 'flags';
const CHANGES_LAYER = 'changes';

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
  const {
    release: releaseItems,
    flag: flagItems,
    timeseriesAnnotation: changeItems,
  } = useAnnotationItems({dataset, interval, enabled: areAnnotationsEnabled});

  const [isReleasesLayerOn, setIsReleasesLayerOn] = useState(true);
  const hasReleases = (releaseItems?.length ?? 0) > 0;
  const isReleasesLayerSelected = hasReleases && isReleasesLayerOn;
  const areReleasesShown = isReleasesLayerSelected && !hidden;

  const [isFlagsLayerOn, setIsFlagsLayerOn] = useState(true);
  const hasFlags = (flagItems?.length ?? 0) > 0;
  const isFlagsLayerSelected = hasFlags && isFlagsLayerOn;
  const areFlagsShown = isFlagsLayerSelected && !hidden;

  const [isChangesLayerOn, setIsChangesLayerOn] = useState(true);
  const hasChanges = (changeItems?.length ?? 0) > 0;
  const isChangesLayerSelected = hasChanges && isChangesLayerOn;
  const areChangesShown = isChangesLayerSelected && !hidden;

  const annotationKinds = useMemo(
    (): AnnotationKind[] => [
      ...(isReleasesLayerSelected ? ['release' as const] : []),
      ...(isFlagsLayerSelected ? ['flag' as const] : []),
      ...(isChangesLayerSelected ? ['timeseriesAnnotation' as const] : []),
    ],
    [isReleasesLayerSelected, isFlagsLayerSelected, isChangesLayerSelected]
  );

  const droppedData = useDroppedDataLayer(
    {dataset, interval},
    {source, annotationKinds, enabled, hidden, showAnnotationTabs: areAnnotationsEnabled}
  );

  const annotations = useMemo(() => {
    const items: AnnotationItem[] = [
      ...(areReleasesShown ? (releaseItems ?? []) : []),
      ...(areFlagsShown ? (flagItems ?? []) : []),
      ...(areChangesShown ? (changeItems ?? []) : []),
    ];
    return items.length > 0 ? items : undefined;
  }, [
    areReleasesShown,
    releaseItems,
    areFlagsShown,
    flagItems,
    areChangesShown,
    changeItems,
  ]);

  const releasesLayer: ChartLayer | undefined =
    areAnnotationsEnabled && defined(releaseItems)
      ? {
          value: RELEASES_LAYER,
          label: t('Releases'),
          selected: isReleasesLayerSelected,
          disabled: !hasReleases,
          tooltip: hasReleases ? undefined : t('No releases in this time range'),
        }
      : undefined;

  const flagsLayer: ChartLayer | undefined =
    areAnnotationsEnabled && defined(flagItems)
      ? {
          value: FLAGS_LAYER,
          label: t('Flags'),
          selected: isFlagsLayerSelected,
          disabled: !hasFlags,
          tooltip: hasFlags ? undefined : t('No flag changes in this time range'),
        }
      : undefined;

  const changesLayer: ChartLayer | undefined =
    areAnnotationsEnabled && defined(changeItems)
      ? {
          value: CHANGES_LAYER,
          label: t('Changes'),
          selected: isChangesLayerSelected,
          disabled: !hasChanges,
          tooltip: hasChanges ? undefined : t('No changes in this time range'),
        }
      : undefined;

  const layers = [
    ...(droppedData.layerControl?.layers ?? []),
    releasesLayer,
    flagsLayer,
    changesLayer,
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
    } else if (value === CHANGES_LAYER) {
      setIsChangesLayerOn(selected);
      trackAnalytics('explore.chart_context.changes_layer_toggled', {
        organization,
        dataset,
        source,
        selected,
      });
    }
  }

  const layerControl: ChartLayersControlProps | undefined =
    layers.length > 0 ? {layers, onChange: onLayerChange} : undefined;

  const {openContextDrawer} = droppedData;
  const onAnnotationClick = useCallback(
    () => openContextDrawer({tab: 'annotations', section: 'activity'}),
    [openContextDrawer]
  );

  return {droppedData, annotations, layerControl, onAnnotationClick};
}
