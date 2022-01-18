import {useEffect, useState} from 'react';
import pick from 'lodash/pick';

import MenuItem from 'sentry/components/menuItem';
import {Panel, PanelBody} from 'sentry/components/panels';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {usePerformanceDisplayType} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';
import ContextMenu from 'sentry/views/dashboardsV2/contextMenu';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

import {GenericPerformanceWidgetDataType} from '../types';
import {_setChartSetting, getChartSetting} from '../utils';
import {PerformanceWidgetSetting, WIDGET_DEFINITIONS} from '../widgetDefinitions';
import {HistogramWidget} from '../widgets/histogramWidget';
import {LineChartListWidget} from '../widgets/lineChartListWidget';
import {LineChartListWidgetMetrics} from '../widgets/lineChartListWidgetMetrics';
import {SingleFieldAreaWidget} from '../widgets/singleFieldAreaWidget';
import {SingleFieldAreaWidgetMetrics} from '../widgets/singleFieldAreaWidgetMetrics';
import {TrendsWidget} from '../widgets/trendsWidget';
import {VitalWidget} from '../widgets/vitalWidget';
import {VitalWidgetMetrics} from '../widgets/vitalWidgetMetrics';

import {ChartRowProps} from './widgetChartRow';

type Props = {
  index: number;
  organization: Organization;
  defaultChartSetting: PerformanceWidgetSetting;
  allowedCharts: PerformanceWidgetSetting[];
  chartHeight: number;
  chartColor?: string;
  eventView: EventView;
  forceDefaultChartSetting?: boolean;
  rowChartSettings: PerformanceWidgetSetting[];
  setRowChartSettings: (settings: PerformanceWidgetSetting[]) => void;
} & ChartRowProps;

function trackChartSettingChange(
  previousChartSetting: PerformanceWidgetSetting,
  chartSetting: PerformanceWidgetSetting,
  fromDefault: boolean,
  organization: Organization
) {
  trackAdvancedAnalyticsEvent('performance_views.landingv3.widget.switch', {
    organization,
    from_widget: previousChartSetting,
    to_widget: chartSetting,
    from_default: fromDefault,
  });
}

const _WidgetContainer = (props: Props) => {
  const {
    organization,
    index,
    chartHeight,
    allowedCharts,
    rowChartSettings,
    setRowChartSettings,
    ...rest
  } = props;
  const {isMetricsData} = useMetricsSwitch();
  const performanceType = usePerformanceDisplayType();
  let _chartSetting = getChartSetting(
    index,
    chartHeight,
    performanceType,
    rest.defaultChartSetting,
    rest.forceDefaultChartSetting
  );

  if (!allowedCharts.includes(_chartSetting)) {
    _chartSetting = rest.defaultChartSetting;
  }

  const [chartSetting, setChartSettingState] = useState(_chartSetting);

  const setChartSetting = (setting: PerformanceWidgetSetting) => {
    if (!props.forceDefaultChartSetting) {
      _setChartSetting(index, chartHeight, performanceType, setting);
    }
    setChartSettingState(setting);
    const newSettings = [...rowChartSettings];
    newSettings[index] = setting;
    setRowChartSettings(newSettings);
    trackChartSettingChange(
      chartSetting,
      setting,
      rest.defaultChartSetting === chartSetting,
      organization
    );
  };

  useEffect(() => {
    setChartSettingState(_chartSetting);
  }, [rest.defaultChartSetting]);

  const chartDefinition = WIDGET_DEFINITIONS({organization, isMetricsData})[chartSetting];
  const widgetProps = {
    ...chartDefinition,
    chartSetting,
    chartDefinition,
    ContainerActions: containerProps => (
      <WidgetContainerActions
        {...containerProps}
        allowedCharts={props.allowedCharts}
        chartSetting={chartSetting}
        setChartSetting={setChartSetting}
        rowChartSettings={rowChartSettings}
      />
    ),
  };

  if (
    isMetricsData &&
    [
      PerformanceWidgetSetting.DURATION_HISTOGRAM,
      PerformanceWidgetSetting.LCP_HISTOGRAM,
      PerformanceWidgetSetting.FCP_HISTOGRAM,
      PerformanceWidgetSetting.FID_HISTOGRAM,
      PerformanceWidgetSetting.MOST_IMPROVED,
      PerformanceWidgetSetting.MOST_REGRESSED,
      PerformanceWidgetSetting.MOST_RELATED_ERRORS,
      PerformanceWidgetSetting.MOST_RELATED_ISSUES,
      PerformanceWidgetSetting.SLOW_HTTP_OPS,
      PerformanceWidgetSetting.SLOW_DB_OPS,
      PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
      PerformanceWidgetSetting.SLOW_BROWSER_OPS,
    ].includes(widgetProps.chartSetting)
  ) {
    // TODO(metrics): Remove this once all widgets are converted
    return (
      <Panel style={{minHeight: '167px', marginBottom: 0}}>
        <PanelBody withPadding>TODO: {widgetProps.title}</PanelBody>
      </Panel>
    );
  }

  const passedProps = pick(props, [
    'eventView',
    'location',
    'organization',
    'chartHeight',
  ]);

  switch (widgetProps.dataType) {
    case GenericPerformanceWidgetDataType.trends:
      return <TrendsWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.area:
      if (isMetricsData) {
        return <SingleFieldAreaWidgetMetrics {...passedProps} {...widgetProps} />;
      }
      return <SingleFieldAreaWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.vitals:
      if (isMetricsData) {
        return <VitalWidgetMetrics {...passedProps} {...widgetProps} />;
      }
      return <VitalWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.line_list:
      if (
        isMetricsData &&
        [
          PerformanceWidgetSetting.MOST_SLOW_FRAMES,
          PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
        ].includes(widgetProps.chartSetting)
      ) {
        return <LineChartListWidgetMetrics {...passedProps} {...widgetProps} />;
      }
      return <LineChartListWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.histogram:
      return <HistogramWidget {...passedProps} {...widgetProps} />;
    default:
      throw new Error(`Widget type "${widgetProps.dataType}" has no implementation.`);
  }
};

export const WidgetContainerActions = ({
  chartSetting,
  setChartSetting,
  allowedCharts,
  rowChartSettings,
}: {
  chartSetting: PerformanceWidgetSetting;
  setChartSetting: (setting: PerformanceWidgetSetting) => void;
  allowedCharts: PerformanceWidgetSetting[];
  rowChartSettings: PerformanceWidgetSetting[];
}) => {
  const organization = useOrganization();
  const menuOptions: React.ReactNode[] = [];

  const settingsMap = WIDGET_DEFINITIONS({organization});
  for (const setting of allowedCharts) {
    const options = settingsMap[setting];
    menuOptions.push(
      <MenuItem
        key={setting}
        onClick={() => setChartSetting(setting)}
        isActive={setting === chartSetting}
        disabled={setting !== chartSetting && rowChartSettings.includes(setting)}
        data-test-id="performance-widget-menu-item"
      >
        {options.title}
      </MenuItem>
    );
  }

  return <ContextMenu>{menuOptions}</ContextMenu>;
};

const WidgetContainer = withOrganization(_WidgetContainer);

export default WidgetContainer;
