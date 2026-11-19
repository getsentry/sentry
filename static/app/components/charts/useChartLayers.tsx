import {useMemo, useState} from 'react';

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
import type {ChartLayer, ChartLayersControlProps} from './chartLayersControl';

const RELEASES_LAYER = 'releases';

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
  const droppedData = useDroppedDataLayer({dataset, interval}, {source, enabled, hidden});

  const isReleasesEnabled =
    enabled && organization.features.includes('timeseries-annotations');
  const {releases: releaseStats} = useReleaseStats(selection, {
    enabled: isReleasesEnabled,
  });
  const [isReleasesLayerOn, setIsReleasesLayerOn] = useState(true);
  const hasReleases = (releaseStats?.length ?? 0) > 0;
  const areReleasesShown = hasReleases && isReleasesLayerOn && !hidden;

  const annotations = useMemo(
    () =>
      areReleasesShown
        ? releaseStats?.map(({date, version}): AnnotationItem => ({
            id: `release:${version}`,
            kind: 'release',
            start: new Date(date).getTime(),
            title: version,
          }))
        : undefined,
    [areReleasesShown, releaseStats]
  );

  const releasesLayer: ChartLayer | undefined =
    isReleasesEnabled && defined(releaseStats)
      ? {
          value: RELEASES_LAYER,
          label: t('Releases'),
          selected: hasReleases && isReleasesLayerOn,
          disabled: !hasReleases,
          tooltip: hasReleases ? undefined : t('No releases in this time range'),
        }
      : undefined;

  const layers = [...(droppedData.layerControl?.layers ?? []), releasesLayer].filter(
    defined
  );

  function onLayerChange(value: string, selected: boolean) {
    if (value === DROPPED_DATA_LAYER) {
      droppedData.layerControl?.onChange(value, selected);
    } else if (value === RELEASES_LAYER) {
      setIsReleasesLayerOn(selected);
      trackAnalytics('releases.bubbles_legend', {organization, selected});
    }
  }

  const layerControl: ChartLayersControlProps | undefined =
    layers.length > 0 ? {layers, onChange: onLayerChange} : undefined;

  return {droppedData, annotations, layerControl};
}
