import pick from 'lodash/pick';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import withOrganization from 'sentry/utils/withOrganization';

import {_setChartSetting} from '../utils';
import {PerformanceWidgetSetting, WIDGET_DEFINITIONS} from '../widgetDefinitions';
import {StackedAreaWidget} from '../widgets/stackedAreaWidget';

import {ChartRowProps} from './widgetChartRow';

type Props = {
  allowedCharts: PerformanceWidgetSetting[];
  chartHeight: number;
  defaultChartSetting: PerformanceWidgetSetting;
  eventView: EventView;
  index: number;
  organization: Organization;
  rowChartSettings: PerformanceWidgetSetting[];
  setRowChartSettings: (settings: PerformanceWidgetSetting[]) => void;
  withStaticFilters: boolean;
  forceDefaultChartSetting?: boolean;
} & ChartRowProps;

const _WidgetContainer = (props: Props) => {
  const {organization} = props;

  const chartSetting = PerformanceWidgetSetting.DB_HTTP_BREAKDOWN;
  const chartDefinition = WIDGET_DEFINITIONS({organization})[chartSetting];

  const widgetProps = {
    ...chartDefinition,
    chartSetting,
    chartDefinition,
    InteractiveTitle: null,
    ContainerActions: null,
  };

  const passedProps = pick(props, [
    'eventView',
    'location',
    'organization',
    'chartHeight',
    'withStaticFilters',
  ]);

  return <StackedAreaWidget {...passedProps} {...widgetProps} />;
};

const WidgetContainer = withOrganization(_WidgetContainer);

export default WidgetContainer;
