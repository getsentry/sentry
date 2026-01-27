import {useCallback, useMemo, useState} from 'react';
import type {LineSeriesOption} from 'echarts';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import {LineChart} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Text} from 'sentry/components/core/text';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {
  EChartClickHandler,
  EChartLegendSelectChangeHandler,
} from 'sentry/types/echarts';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {isSizeInfoCompleted} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getSizeBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';

export enum SizeMetric {
  INSTALL_SIZE = 'install_size',
  DOWNLOAD_SIZE = 'download_size',
}

interface MobileBuildsChartProps {
  builds: BuildDetailsApiResponse[];
  isLoading: boolean;
  organizationSlug: string;
}

interface SeriesKey {
  appId: string | null;
  buildConfiguration: string | null;
  platform: string | null;
}

function getSeriesKey(build: BuildDetailsApiResponse): string {
  const {app_id, platform, build_configuration} = build.app_info;
  return `${app_id ?? 'unknown'}|${platform ?? 'unknown'}|${build_configuration ?? 'unknown'}`;
}

function getSeriesLabel(key: SeriesKey): string {
  const parts = [
    key.appId ?? 'Unknown App',
    key.platform ?? 'Unknown',
    key.buildConfiguration ?? 'Unknown',
  ];
  return parts.join(' | ');
}

function parseSeriesKey(key: string): SeriesKey {
  const [appId, platform, buildConfiguration] = key.split('|');
  return {
    appId: appId === 'unknown' ? null : (appId ?? null),
    platform: platform === 'unknown' ? null : (platform ?? null),
    buildConfiguration:
      buildConfiguration === 'unknown' ? null : (buildConfiguration ?? null),
  };
}

export function MobileBuildsChart({
  builds,
  isLoading,
  organizationSlug,
}: MobileBuildsChartProps) {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<SizeMetric>(SizeMetric.INSTALL_SIZE);
  const [legendSelected, setLegendSelected] = useState<Record<string, boolean>>({});

  // Group builds by (app_id, platform, build_configuration) and transform to chart series
  // Also create a lookup map: seriesKey -> dataIndex -> build
  const {series, seriesBuildLookup} = useMemo(() => {
    const grouped = new Map<string, BuildDetailsApiResponse[]>();

    // Filter to builds with completed size info and group them
    for (const build of builds) {
      if (!isSizeInfoCompleted(build.size_info)) {
        continue;
      }

      const key = getSeriesKey(build);
      const existing = grouped.get(key) ?? [];
      existing.push(build);
      grouped.set(key, existing);
    }

    // Map from seriesId -> dataIndex -> build for click lookup
    const buildLookup = new Map<string, Map<number, BuildDetailsApiResponse>>();

    // Transform grouped builds into chart series
    const chartSeries = Array.from(grouped.entries()).map(([key, groupBuilds]) => {
      // Sort builds by date for consistent line drawing
      const sortedBuilds = [...groupBuilds].sort(
        (a, b) =>
          new Date(a.app_info.date_added ?? 0).getTime() -
          new Date(b.app_info.date_added ?? 0).getTime()
      );

      const indexMap = new Map<number, BuildDetailsApiResponse>();
      const data: Array<{name: number; value: number}> = [];

      sortedBuilds.forEach(build => {
        // Re-check isSizeInfoCompleted for TypeScript narrowing
        if (!isSizeInfoCompleted(build.size_info)) {
          return;
        }

        // Get the main artifact size metric (first one with MAIN_ARTIFACT type)
        const sizeMetrics = build.size_info.size_metrics;
        const mainMetric = sizeMetrics[0];
        if (!mainMetric) {
          return;
        }

        const sizeValue =
          metric === SizeMetric.INSTALL_SIZE
            ? mainMetric.install_size_bytes
            : mainMetric.download_size_bytes;

        const timestamp = new Date(build.app_info.date_added ?? 0).getTime();

        data.push({
          name: timestamp,
          value: sizeValue,
        });
        indexMap.set(data.length - 1, build);
      });

      buildLookup.set(key, indexMap);

      return {
        id: key,
        seriesName: getSeriesLabel(parseSeriesKey(key)),
        data,
        emphasis: {
          focus: 'series',
        } as LineSeriesOption['emphasis'],
      };
    });

    return {series: chartSeries, seriesBuildLookup: buildLookup};
  }, [builds, metric]);

  const handleClick = useCallback<EChartClickHandler>(
    params => {
      const seriesId = params.seriesId;
      const dataIndex = params.dataIndex;

      if (seriesId === undefined || dataIndex === undefined) {
        return;
      }

      const indexMap = seriesBuildLookup.get(seriesId);
      if (!indexMap) {
        return;
      }

      const build = indexMap.get(dataIndex);
      if (!build) {
        return;
      }

      const path = getSizeBuildPath({
        organizationSlug,
        projectId: build.project_id.toString(),
        baseArtifactId: build.id,
      });

      if (path) {
        navigate(path);
      }
    },
    [seriesBuildLookup, organizationSlug, navigate]
  );

  const handleLegendSelectChanged = useCallback<EChartLegendSelectChangeHandler>(
    params => {
      setLegendSelected(params.selected);
    },
    []
  );

  if (isLoading) {
    return (
      <Panel>
        <PanelBody withPadding>
          <Placeholder height="24px" />
          <Placeholder height="200px" />
        </PanelBody>
      </Panel>
    );
  }

  if (series.length === 0) {
    return null;
  }

  // Get min/max timestamps for x-axis
  const allTimestamps = series.flatMap(s => s.data.map(d => d.name));
  const minTime = Math.min(...allTimestamps);
  const maxTime = Math.max(...allTimestamps);

  return (
    <Panel>
      <PanelBody withPadding>
        <Flex align="center" justify="between" marginBottom="md">
          <Text bold>{t('App Size')}</Text>
          <CompactSelect
            size="xs"
            value={metric}
            options={[
              {value: SizeMetric.INSTALL_SIZE, label: t('Install Size')},
              {value: SizeMetric.DOWNLOAD_SIZE, label: t('Download Size')},
            ]}
            onChange={opt => setMetric(opt.value)}
          />
        </Flex>
        <TransitionChart loading={isLoading} reloading={false}>
          <TransparentLoadingMask visible={false} />
          <LineChart
            height={200}
            grid={{left: '10px', right: '10px', top: '30px', bottom: '0px'}}
            series={series}
            legend={{
              show: true,
              top: 0,
              left: 0,
              selected: legendSelected,
            }}
            onLegendSelectChanged={handleLegendSelectChanged}
            yAxis={{
              type: 'value',
              axisLabel: {
                formatter: (value: number) => formatBytesBase10(value),
              },
            }}
            xAxis={{
              show: true,
              min: minTime,
              max: maxTime,
              type: 'time',
              axisLabel: {
                formatter: (value: number) => moment(value).format('MMM D'),
              },
            }}
            tooltip={{
              trigger: 'axis',
              valueFormatter: (value: number | string) =>
                typeof value === 'number' ? formatBytesBase10(value) : value,
              formatter: (seriesParams: any) => {
                const params = Array.isArray(seriesParams)
                  ? seriesParams
                  : [seriesParams];
                if (params.length === 0) {
                  return '';
                }
                const timestamp = params[0]?.data?.[0] ?? params[0]?.name;
                const formattedDate = moment(timestamp).format('MMM D, YYYY h:mm A');

                const rows = params
                  .map(
                    (p: any) =>
                      `<div><span class="tooltip-label">${p.marker}<strong>${p.seriesName}</strong></span> ${formatBytesBase10(p.data?.[1] ?? p.value)}</div>`
                  )
                  .join('');

                return `<div class="tooltip-series">${rows}</div><div class="tooltip-footer">${formattedDate}</div>`;
              },
            }}
            onClick={handleClick}
          />
        </TransitionChart>
      </PanelBody>
    </Panel>
  );
}
