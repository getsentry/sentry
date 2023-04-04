import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {MapSeriesOption, TooltipComponentOption} from 'echarts';
import * as echarts from 'echarts/core';
import max from 'lodash/max';

import {Series, SeriesDataUnit} from 'sentry/types/echarts';

import VisualMap from './components/visualMap';
import MapSeries from './series/mapSeries';
import BaseChart from './baseChart';

type ChartProps = Omit<React.ComponentProps<typeof BaseChart>, 'css'>;

type MapChartSeriesDataUnit = Omit<SeriesDataUnit, 'name' | 'itemStyle'> & {
  // Docs for map itemStyle differ from Series data unit. See https://echarts.apache.org/en/option.html#series-map.data.itemStyle
  itemStyle?: MapSeriesOption['itemStyle'];
  name?: string;
};

type MapChartSeries = Omit<Series, 'data'> & {
  data: MapChartSeriesDataUnit[];
};

export interface WorldMapChartProps extends Omit<ChartProps, 'series'> {
  series: MapChartSeries[];
  fromDiscover?: boolean;
  fromDiscoverQueryList?: boolean;
  seriesOptions?: MapSeriesOption;
}

type JSONResult = Record<string, any>;

type State = {
  codeToCountryMap: JSONResult | null;
  countryToCodeMap: JSONResult | null;
  map: JSONResult | null;
};

const DEFAULT_ZOOM = 1.3;
const DISCOVER_ZOOM = 1.1;
const DISCOVER_QUERY_LIST_ZOOM = 0.9;
const DEFAULT_CENTER_X = 10.97;
const DISCOVER_QUERY_LIST_CENTER_Y = -12;
const DEFAULT_CENTER_Y = 9.71;

export const WorldMapChart = ({
  series,
  seriesOptions,
  fromDiscover,
  fromDiscoverQueryList,
  ...props
}: WorldMapChartProps) => {
  const theme = useTheme();
  const [state, setState] = useState<State>(() => ({
    countryToCodeMap: null,
    map: null,
    codeToCountryMap: null,
  }));

  useEffect(() => {
    let unmounted = false;

    if (!unmounted) {
      loadWorldMap();
    }

    return () => {
      unmounted = true;
    };
  }, []);

  async function loadWorldMap() {
    try {
      const [countryCodesMap, world] = await Promise.all([
        import('sentry/data/countryCodesMap'),
        import('sentry/data/world.json'),
      ]);

      const countryToCodeMap = countryCodesMap.default;
      const worldMap = world.default;

      // Echarts not available in tests
      echarts.registerMap?.('sentryWorld', worldMap as any);

      const codeToCountryMap: Record<string, string> = {};

      for (const country in worldMap) {
        codeToCountryMap[countryToCodeMap[country]] = country;
      }

      setState({
        countryToCodeMap,
        map: worldMap,
        codeToCountryMap,
      });
    } catch {
      // do nothing
    }
  }

  if (state.countryToCodeMap === null || state.map === null) {
    return null;
  }

  const processedSeries = series.map(({seriesName, data, ...options}) =>
    MapSeries({
      ...seriesOptions,
      ...options,
      map: 'sentryWorld',
      name: seriesName,
      nameMap: state.countryToCodeMap ?? undefined,
      aspectScale: 0.85,
      zoom: fromDiscover
        ? DISCOVER_ZOOM
        : fromDiscoverQueryList
        ? DISCOVER_QUERY_LIST_ZOOM
        : DEFAULT_ZOOM,
      center: [
        DEFAULT_CENTER_X,
        fromDiscoverQueryList ? DISCOVER_QUERY_LIST_CENTER_Y : DEFAULT_CENTER_Y,
      ],
      itemStyle: {
        areaColor: theme.gray200,
        borderColor: theme.backgroundSecondary,
      },
      emphasis: {
        itemStyle: {
          areaColor: theme.pink300,
        },
        label: {
          show: false,
        },
      },
      data,
      silent: fromDiscoverQueryList,
      roam: !fromDiscoverQueryList,
    })
  );

  // TODO(billy):
  // For absolute values, we want min/max to based on min/max of series
  // Otherwise it should be 0-100
  const maxValue = max(series.map(({data}) => max(data.map(({value}) => value)))) || 1;

  const tooltipFormatter: TooltipComponentOption['formatter'] = (format: any) => {
    const {marker, name, value} = Array.isArray(format) ? format[0] : format;
    // If value is NaN, don't show anything because we won't have a country code either
    if (isNaN(value as number)) {
      return '';
    }

    // `value` should be a number
    const formattedValue = typeof value === 'number' ? value.toLocaleString() : '';
    const countryOrCode = state.codeToCountryMap?.[name as string] || name;

    return [
      `<div class="tooltip-series tooltip-series-solo">
               <div><span class="tooltip-label">${marker} <strong>${countryOrCode}</strong></span> ${formattedValue}</div>
            </div>`,
      '<div class="tooltip-arrow"></div>',
    ].join('');
  };

  return (
    <BaseChart
      options={{
        backgroundColor: fromDiscoverQueryList ? undefined : theme.background,
        visualMap: [
          VisualMap({
            show: !fromDiscoverQueryList,
            left: fromDiscover ? undefined : 'right',
            right: fromDiscover ? 5 : undefined,
            min: 0,
            max: maxValue,
            inRange: {
              color: [theme.purple200, theme.purple300],
            },
            text: ['High', 'Low'],
            textStyle: {
              color: theme.textColor,
            },

            // Whether show handles, which can be dragged to adjust "selected range".
            // False because the handles are pretty ugly
            calculable: false,
          }),
        ],
      }}
      {...props}
      yAxis={null}
      xAxis={null}
      series={processedSeries}
      tooltip={{
        formatter: tooltipFormatter,
      }}
      height={fromDiscover ? 400 : undefined}
    />
  );
};
