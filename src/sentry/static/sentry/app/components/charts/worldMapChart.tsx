import React from 'react';
import echarts, {EChartOption} from 'echarts';
import {withTheme} from 'emotion-theming';
import max from 'lodash/max';

import {Series, SeriesDataUnit} from 'app/types/echarts';
import {Theme} from 'app/utils/theme';

import VisualMap from './components/visualMap';
import MapSeries from './series/mapSeries';
import BaseChart from './baseChart';

type ChartProps = React.ComponentProps<typeof BaseChart>;

type MapChartSeriesDataUnit = Omit<SeriesDataUnit, 'name' | 'itemStyle'> & {
  // Docs for map itemStyle differ from Series data unit. See https://echarts.apache.org/en/option.html#series-map.data.itemStyle
  itemStyle: EChartOption.SeriesMap.DataObject['itemStyle'];
  name?: string;
};

type MapChartSeries = Omit<Series, 'data'> & {
  data: MapChartSeriesDataUnit[];
};

type Props = Omit<ChartProps, 'series'> & {
  series: MapChartSeries[];
  theme: Theme;
  seriesOptions?: EChartOption.SeriesMap;
};

type JSONResult = Record<string, any>;

type State = {
  countryToCodeMap: JSONResult | null;
  map: JSONResult | null;
  codeToCountryMap: JSONResult | null;
};

class WorldMapChart extends React.Component<Props, State> {
  state: State = {
    countryToCodeMap: null,
    map: null,
    codeToCountryMap: null,
  };

  async componentDidMount() {
    const [countryToCodeMap, worldMap] = await Promise.all([
      import(/* webpackChunkName: "countryCodesMap" */ 'app/data/countryCodesMap'),
      import(/* webpackChunkName: "worldMapGeoJson" */ 'app/data/world.json'),
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

    const {series, seriesOptions, theme, ...props} = this.props;
    const processedSeries = series.map(({seriesName, data, ...options}) =>
      MapSeries({
        ...seriesOptions,
        ...options,
        map: 'sentryWorld',
        name: seriesName,
        nameMap: this.state.countryToCodeMap ?? undefined,
        aspectScale: 0.85,
        zoom: 1.3,
        center: [10.97, 9.71],
        itemStyle: {
          areaColor: theme.gray200,
          borderColor: theme.backgroundSecondary,
          emphasis: {
            areaColor: theme.orange300,
          },
        } as any, // TODO(ts): Echarts types aren't correct for these colors as they don't allow for basic strings
        label: {
          emphasis: {
            show: false,
          },
        },
        data,
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
          backgroundColor: theme.background,
          visualMap: [
            VisualMap({
              left: 'right',
              min: 0,
              max: maxValue,
              inRange: {
                color: [theme.purple200, theme.purple300],
              },
              text: ['High', 'Low'],

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
      />
    );
  }
}

export default withTheme(WorldMapChart);
