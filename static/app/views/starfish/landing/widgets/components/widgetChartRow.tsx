import {Location} from 'history';

import EventView from 'sentry/utils/discover/eventView';

import {PerformanceWidgetSetting} from '../widgetDefinitions';

export type ChartRowProps = {
  allowedCharts: PerformanceWidgetSetting[];
  chartCount: number;
  chartHeight: number;
  eventView: EventView;
  location: Location;
  withStaticFilters: boolean;
};
