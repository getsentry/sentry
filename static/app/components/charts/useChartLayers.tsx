import {useCallback, useMemo, useState} from 'react';

import {
  DROPPED_DATA_LAYER,
  useDroppedDataLayer,
} from 'sentry/components/droppedData/useDroppedDataLayer';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {defined} from 'sentry/utils/defined';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

import type {AnnotationItem} from './annotations/types';
import {useAnnotationFlagLog} from './annotations/useAnnotationFlagLog';
import {annotationContextTab} from './contextDrawer/chartContextDrawer';
import type {ChartLayer, ChartLayersControlProps} from './chartLayersControl';
import {CONFIDENCE_LAYER, useConfidenceLayer} from './useConfidenceLayer';

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
  const {selection} = usePageFilters();
  const areAnnotationsEnabled =
    enabled && organization.features.includes('timeseries-annotations');
  const droppedData = useDroppedDataLayer(
    {dataset, interval},
    {source, enabled, hidden, showAnnotationTabs: areAnnotationsEnabled}
  );

  const confidence = useConfidenceLayer({source, enabled});

  const {releases: releaseStats} = useReleaseStats(selection, {
    enabled: areAnnotationsEnabled,
  });
  const [isReleasesLayerOn, setIsReleasesLayerOn] = useState(true);
  const hasReleases = (releaseStats?.length ?? 0) > 0;
  const areReleasesShown = hasReleases && isReleasesLayerOn && !hidden;

  const {data: flagLog} = useAnnotationFlagLog({enabled: areAnnotationsEnabled});
  const [isFlagsLayerOn, setIsFlagsLayerOn] = useState(true);
  const hasFlags = (flagLog?.length ?? 0) > 0;
  const areFlagsShown = hasFlags && isFlagsLayerOn && !hidden;

  const annotations = useMemo(() => {
    const items: AnnotationItem[] = [
      ...(areReleasesShown
        ? (releaseStats ?? []).map(({date, version}): AnnotationItem => ({
            id: `release:${version}`,
            kind: 'release',
            start: new Date(date).getTime(),
            title: version,
          }))
        : []),
      ...(areFlagsShown
        ? (flagLog ?? []).map(({id, createdAt, flag}): AnnotationItem => ({
            id: `flag:${id}`,
            kind: 'flag',
            start: new Date(createdAt).getTime(),
            title: flag,
          }))
        : []),
    ];
    return items.length > 0 ? items : undefined;
  }, [areReleasesShown, releaseStats, areFlagsShown, flagLog]);

  const releasesLayer: ChartLayer | undefined =
    areAnnotationsEnabled && defined(releaseStats)
      ? {
          value: RELEASES_LAYER,
          label: t('Releases'),
          selected: hasReleases && isReleasesLayerOn,
          disabled: !hasReleases,
          tooltip: hasReleases ? undefined : t('No releases in this time range'),
        }
      : undefined;

  const flagsLayer: ChartLayer | undefined =
    areAnnotationsEnabled && defined(flagLog)
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
    ...(confidence.layerControl?.layers ?? []),
    releasesLayer,
    flagsLayer,
  ].filter(defined);

  function onLayerChange(value: string, selected: boolean) {
    if (value === DROPPED_DATA_LAYER) {
      droppedData.layerControl?.onChange(value, selected);
    } else if (value === CONFIDENCE_LAYER) {
      confidence.layerControl?.onChange(value, selected);
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

  return {
    droppedData,
    annotations,
    layerControl,
    onAnnotationClick,
    showConfidence: confidence.showConfidence,
  };
}
