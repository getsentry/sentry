import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import PercentageAreaChart from 'app/components/charts/percentageAreaChart';
import PercentageTableChart from 'app/components/charts/percentageTableChart';
import PieChart from 'app/components/charts/pieChart';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import WorldMapChart from 'app/components/charts/worldMapChart';

import {WIDGET_DISPLAY} from '../constants';

const CHART_MAP = {
  [WIDGET_DISPLAY.LINE_CHART]: LineChart,
  [WIDGET_DISPLAY.AREA_CHART]: AreaChart,
  [WIDGET_DISPLAY.STACKED_AREA_CHART]: StackedAreaChart,
  [WIDGET_DISPLAY.BAR_CHART]: BarChart,
  [WIDGET_DISPLAY.PIE_CHART]: PieChart,
  [WIDGET_DISPLAY.WORLD_MAP]: WorldMapChart,
  [WIDGET_DISPLAY.TABLE]: PercentageTableChart,
  [WIDGET_DISPLAY.PERCENTAGE_AREA_CHART]: PercentageAreaChart,
};

export function getChartComponent({type}) {
  return CHART_MAP[type];
}
