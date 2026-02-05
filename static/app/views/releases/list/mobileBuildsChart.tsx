import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {LineSeriesOption, TooltipComponentFormatterCallbackParams} from 'echarts';
import moment from 'moment-timezone';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {LineChart} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EChartClickHandler} from 'sentry/types/echarts';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getMainArtifactSizeMetric,
  isSizeInfoCompleted,
} from 'sentry/views/preprod/types/buildDetailsTypes';
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
    appId: !appId || appId === 'unknown' ? null : appId,
    platform: !platform || platform === 'unknown' ? null : platform,
    buildConfiguration:
      !buildConfiguration || buildConfiguration === 'unknown' ? null : buildConfiguration,
  };
}

export function MobileBuildsChart({
  builds,
  isLoading,
  organizationSlug,
}: MobileBuildsChartProps) {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<SizeMetric>(SizeMetric.INSTALL_SIZE);

  const {series, seriesBuildLookup, minTime, maxTime} = useMemo(() => {
    const grouped = new Map<string, BuildDetailsApiResponse[]>();

    for (const build of builds) {
      if (!isSizeInfoCompleted(build.size_info)) {
        continue;
      }

      const key = getSeriesKey(build);
      const existing = grouped.get(key) ?? [];
      existing.push(build);
      grouped.set(key, existing);
    }

    const buildLookup = new Map<string, Map<number, BuildDetailsApiResponse>>();

    const chartSeries = Array.from(grouped.entries()).map(([key, groupBuilds]) => {
      const sortedBuilds = [...groupBuilds].sort(
        (a, b) =>
          new Date(a.app_info.date_added ?? 0).getTime() -
          new Date(b.app_info.date_added ?? 0).getTime()
      );

      const indexMap = new Map<number, BuildDetailsApiResponse>();
      const data: Array<{name: number; value: number}> = [];

      sortedBuilds.forEach(build => {
        if (!isSizeInfoCompleted(build.size_info)) {
          return;
        }
        const mainMetric = getMainArtifactSizeMetric(build.size_info);
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
        symbol: 'circle',
        showSymbol: true,
        symbolSize: 6,
        emphasis: {
          focus: 'series',
        } as LineSeriesOption['emphasis'],
      };
    });

    const allTimestamps = chartSeries.flatMap(s => s.data.map(d => d.name));

    return {
      series: chartSeries,
      seriesBuildLookup: buildLookup,
      minTime: allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0,
      maxTime: allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0,
    };
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

  if (isLoading) {
    return (
      <Panel>
        <PanelBody withPadding>
          <Placeholder height="250px" />
        </PanelBody>
      </Panel>
    );
  }

  if (series.length === 0 || (minTime === 0 && maxTime === 0)) {
    return null;
  }

  return (
    <Panel>
      <PanelBody withPadding>
        <Container marginBottom="md">
          <StyledCompactSelect
            options={[
              {value: SizeMetric.INSTALL_SIZE, label: t('Install/Uncompressed Size')},
              {value: SizeMetric.DOWNLOAD_SIZE, label: t('Download Size')},
            ]}
            value={metric}
            onChange={opt => setMetric(opt.value as SizeMetric)}
            trigger={triggerProps => (
              <OverlayTrigger.Button
                {...triggerProps}
                priority="transparent"
                size="zero"
              />
            )}
            offset={4}
          />
        </Container>
        <TransitionChart loading={isLoading} reloading={false}>
          <LineChart
            height={200}
            grid={{left: '10px', right: '10px', top: '30px', bottom: '0px'}}
            series={series}
            legend={{
              show: true,
              top: 0,
              left: 0,
            }}
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
              formatter: (seriesParams: TooltipComponentFormatterCallbackParams) => {
                const params = Array.isArray(seriesParams)
                  ? seriesParams
                  : [seriesParams];
                const firstParam = params[0];
                if (!firstParam) {
                  return '';
                }
                const timestamp = (firstParam as {axisValue?: number}).axisValue ?? 0;
                const formattedDate = moment(timestamp).format('MMM D, YYYY h:mm A');

                const rows = params
                  .map(param => {
                    const value = (param.value as number[])[1];
                    const marker = typeof param.marker === 'string' ? param.marker : '';
                    return `<div><span class="tooltip-label">${marker}<strong>${param.seriesName}</strong></span> ${formatBytesBase10(value)}</div>`;
                  })
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

const StyledCompactSelect = styled(CompactSelect)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  min-width: 0;

  button {
    padding: ${space(0.5)} ${space(1)};
    font-size: ${p => p.theme.font.size.lg};
    font-weight: ${p => p.theme.font.weight.sans.medium};
  }
`;
