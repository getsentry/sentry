import {useEffect, useState} from 'react';
import pick from 'lodash/pick';

import DropdownButtonV2 from 'sentry/components/dropdownButtonV2';
import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {usePerformanceDisplayType} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';

import {GenericPerformanceWidgetDataType} from '../types';
import {_setChartSetting, getChartSetting} from '../utils';
import {PerformanceWidgetSetting, WIDGET_DEFINITIONS} from '../widgetDefinitions';
import {HistogramWidget} from '../widgets/histogramWidget';
import {LineChartListWidget} from '../widgets/lineChartListWidget';
import {SingleFieldAreaWidget} from '../widgets/singleFieldAreaWidget';
import {TrendsWidget} from '../widgets/trendsWidget';
import {VitalWidget} from '../widgets/vitalWidget';

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
  chartColor?: string;
  forceDefaultChartSetting?: boolean;
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

  const chartDefinition = WIDGET_DEFINITIONS({organization})[chartSetting];
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

  const passedProps = pick(props, [
    'eventView',
    'location',
    'organization',
    'chartHeight',
    'noCellActions',
  ]);

  switch (widgetProps.dataType) {
    case GenericPerformanceWidgetDataType.trends:
      return <TrendsWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.area:
      return <SingleFieldAreaWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.vitals:
      return <VitalWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.line_list:
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
  allowedCharts: PerformanceWidgetSetting[];
  chartSetting: PerformanceWidgetSetting;
  rowChartSettings: PerformanceWidgetSetting[];
  setChartSetting: (setting: PerformanceWidgetSetting) => void;
}) => {
  const organization = useOrganization();
  const menuOptions: React.ComponentProps<typeof CompactSelect>['options'] = [];

  const settingsMap = WIDGET_DEFINITIONS({organization});
  for (const setting of allowedCharts) {
    const options = settingsMap[setting];
    menuOptions.push({
      value: setting,
      label: options.title,
      disabled: setting !== chartSetting && rowChartSettings.includes(setting),
    });
  }

  function trigger({props, ref}) {
    return (
      <DropdownButtonV2
        ref={ref}
        {...props}
        size="xsmall"
        borderless
        showChevron={false}
        icon={<IconEllipsis aria-label={t('More')} />}
      />
    );
  }

  return (
    <CompactSelect
      onChange={opt => setChartSetting(opt.value)}
      options={menuOptions}
      isOptionDisabled={opt => opt.disabled}
      value={chartSetting}
      trigger={trigger}
      placement="bottom right"
    />
  );
};

const WidgetContainer = withOrganization(_WidgetContainer);

export default WidgetContainer;
