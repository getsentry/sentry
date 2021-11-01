import * as React from 'react';
import {withTheme} from '@emotion/react';
import echarts, {EChartOption} from 'echarts';
import max from 'lodash/max';

import {Series, SeriesDataUnit} from 'app/types/echarts';
import {Theme} from 'app/utils/theme';

import VisualMap from './components/visualMap';
import MapSeries from './series/mapSeries';
import BaseChart from './baseChart';

type ChartProps = React.ComponentProps<typeof BaseChart>;

type MapChartSeriesDataUnit = Omit<SeriesDataUnit, 'name' | 'itemStyle'> & {
  // Docs for map itemStyle differ from Series data unit. See https://echarts.apache.org/en/option.html#series-map.data.itemStyle
  itemStyle?: EChartOption.SeriesMap.DataObject['itemStyle'];
  name?: string;
};

type MapChartSeries = Omit<Series, 'data'> & {
  data: MapChartSeriesDataUnit[];
};

type Props = Omit<ChartProps, 'series'> & {
  series: MapChartSeries[];
  theme: Theme;
  seriesOptions?: EChartOption.SeriesMap;
  fromDiscover?: boolean;
  fromDiscoverQueryList?: boolean;
};

type JSONResult = Record<string, any>;

type State = {
  countryToCodeMap: JSONResult | null;
  map: JSONResult | null;
  codeToCountryMap: JSONResult | null;
};

const DEFAULT_ZOOM = 1.3;
const DISCOVER_ZOOM = 1.1;
const DISCOVER_QUERY_LIST_ZOOM = 0.9;
const DEFAULT_CENTER_X = 10.97;
const DISCOVER_QUERY_LIST_CENTER_Y = -12;
const DEFAULT_CENTER_Y = 9.71;

class WorldMapChart extends React.Component<Props, State> {
  state: State = {
    countryToCodeMap: null,
    map: null,
    codeToCountryMap: null,
  };

  async componentDidMount() {
    const [countryToCodeMap, worldMap] = await Promise.all([
      import('app/data/countryCodesMap'),
      import('app/data/world.json'),
    ]);

    echarts.registerMap('sentryWorld', worldMap.default);

    // eslint-disable-next-line
    this.setState({
      countryToCodeMap: countryToCodeMap.default,
      map: worldMap.default,
      codeToCountryMap: Object.fromEntries(
        Object.entries(countryToCodeMap.default).map(([country, code]) => [code, country])
      ),
    });
  }

  render() {
    const {countryToCodeMap, map} = this.state;

    if (countryToCodeMap === null || map === null) {
      return null;
    }

    const {series, seriesOptions, theme, fromDiscover, fromDiscoverQueryList, ...props} =
      this.props;
    const processedSeries = series.map(({seriesName, data, ...options}) =>
      MapSeries({
        ...seriesOptions,
        ...options,
        map: 'sentryWorld',
        name: seriesName,
        nameMap: this.state.countryToCodeMap ?? undefined,
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
          emphasis: {
            areaColor: theme.pink300,
          },
        } as any, // TODO(ts): Echarts types aren't correct for these colors as they don't allow for basic strings
        label: {
          emphasis: {
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

    const tooltipFormatter: EChartOption.Tooltip.Formatter = (
      format: EChartOption.Tooltip.Format | EChartOption.Tooltip.Format[]
    ) => {
      const {marker, name, value} = Array.isArray(format) ? format[0] : format;
      // If value is NaN, don't show anything because we won't have a country code either
      if (isNaN(value as number)) {
        return '';
      }

      // `value` should be a number
      const formattedValue = typeof value === 'number' ? value.toLocaleString() : '';
      const countryOrCode = this.state.codeToCountryMap?.[name as string] || name;

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
          backgroundColor: !fromDiscoverQueryList ? theme.background : undefined,
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
  }
}

export default withTheme(WorldMapChart);
