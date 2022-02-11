import {useMemo} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import OptionSelector from 'sentry/components/charts/optionSelector';
import ScatterChart from 'sentry/components/charts/scatterChart';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getSeriesSelection} from 'sentry/components/charts/utils';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {SelectValue} from 'sentry/types';
import {EChartClickHandler, SeriesDataUnit} from 'sentry/types/echarts';
import {Trace} from 'sentry/types/profiling/trace';
import {defined} from 'sentry/utils';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import getDynamicText from 'sentry/utils/getDynamicText';
import {decodeScalar} from 'sentry/utils/queryString';

interface Props extends WithRouterProps {
  location: Location;
  traces: Trace[];
  end?: string;
  start?: string;
  statsPeriod?: string | null;
  utc?: string;
}

function _ProfileScatterChart({
  router,
  location,
  traces,
  start,
  end,
  statsPeriod,
  utc,
}: Props) {
  const theme = useTheme();

  const colorEncoding = useMemo(() => getColorEncodingFromLocation(location), [location]);

  const series = useMemo(() => {
    const seriesMap: Record<string, SeriesDataUnit[]> = {};

    for (const row of traces) {
      const seriesName = row[colorEncoding];
      if (!seriesMap.hasOwnProperty(seriesName)) {
        seriesMap[seriesName] = [];
      }
      seriesMap[seriesName].push({
        name: row.start_time_unix * 1000,
        value: row.trace_duration_ms,
      });
    }

    return Object.entries(seriesMap).map(([seriesName, data]) => ({seriesName, data}));
  }, [colorEncoding]);

  // TODO
  const onClickHandler: EChartClickHandler = _params => {};

  const loading = false;
  const reloading = false;

  const chartOptions = {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px',
    },
    tooltip: {
      trigger: 'item' as const,
      valueFormatter: (value: number) => tooltipFormatter(value, 'p50()'),
    },
    yAxis: {
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
      },
    },
    legend: {
      right: 10,
      top: 5,
      selected: getSeriesSelection(location),
    },
    onClick: onClickHandler,
  };

  return (
    <Panel>
      <ChartContainer>
        <ChartZoom
          router={router}
          period={statsPeriod}
          start={start}
          end={end}
          utc={utc === 'true'}
        >
          {zoomRenderProps => {
            return (
              <TransitionChart loading={loading} reloading={reloading}>
                <TransparentLoadingMask visible={reloading} />
                {getDynamicText({
                  value: (
                    <ScatterChart
                      series={series}
                      {...chartOptions}
                      {...zoomRenderProps}
                    />
                  ),
                  fixed: <Placeholder height="200px" />,
                })}
              </TransitionChart>
            );
          }}
        </ChartZoom>
      </ChartContainer>
      <ChartControls>
        <InlineContainer />
        <InlineContainer>
          <OptionSelector
            title={t('Group By')}
            selected={colorEncoding}
            options={COLOR_ENCODINGS}
            onChange={value => {
              browserHistory.push({
                ...location,
                query: {
                  ...location.query,
                  colorEncoding: value,
                },
              });
            }}
          />
        </InlineContainer>
      </ChartControls>
    </Panel>
  );
}

const ProfileScatterChart = withRouter(_ProfileScatterChart);

enum ColorEncoding {
  AppVersion = 'app_version',
  DeviceManufacturer = 'device_manufacturer',
  DeviceModel = 'device_model',
  DeviceOsVersion = 'device_os_version',
  InteractionName = 'interaction_name',
  AndroidApiLevel = 'android_api_level',
}

const COLOR_ENCODING_LABELS: Record<ColorEncoding, string> = {
  [ColorEncoding.AppVersion]: t('App Version'),
  [ColorEncoding.DeviceManufacturer]: t('Device Manufacturer'),
  [ColorEncoding.DeviceModel]: t('Device Model'),
  [ColorEncoding.DeviceOsVersion]: t('Device Os Version'),
  [ColorEncoding.InteractionName]: t('Interaction Name'),
  [ColorEncoding.AndroidApiLevel]: t('Android Api Level'),
};

const COLOR_ENCODINGS: SelectValue<ColorEncoding>[] = Object.entries(
  COLOR_ENCODING_LABELS
).map(([value, label]) => ({label, value: value as ColorEncoding}));

function getColorEncodingFromLocation(location: Location): ColorEncoding {
  const colorCoding = decodeScalar(location.query.colorEncoding);

  if (defined(colorCoding) && COLOR_ENCODING_LABELS.hasOwnProperty(colorCoding)) {
    return colorCoding as ColorEncoding;
  }

  return ColorEncoding.InteractionName;
}

export {ProfileScatterChart};
