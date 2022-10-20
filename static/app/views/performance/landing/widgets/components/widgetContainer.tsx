import {useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import CompositeSelect from 'sentry/components/compositeSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {Field} from 'sentry/utils/discover/fields';
import {DisplayModes} from 'sentry/utils/discover/types';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePerformanceDisplayType} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';

import {GenericPerformanceWidgetDataType} from '../types';
import {_setChartSetting, filterAllowedChartsMetrics, getChartSetting} from '../utils';
import {
  ChartDefinition,
  PerformanceWidgetSetting,
  WIDGET_DEFINITIONS,
} from '../widgetDefinitions';
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
  withStaticFilters: boolean;
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
  const mepSetting = useMEPSettingContext();
  const allowedCharts = filterAllowedChartsMetrics(
    props.organization,
    props.allowedCharts,
    mepSetting
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
  }, [rest.defaultChartSetting, _chartSetting]);

  const chartDefinition = WIDGET_DEFINITIONS({organization})[chartSetting];

  // Construct an EventView that matches this widget's definition. The
  // `eventView` from the props is the _landing page_ EventView, which is different
  const widgetEventView = makeEventViewForWidget(props.eventView, chartDefinition);

  const widgetProps = {
    ...chartDefinition,
    chartSetting,
    chartDefinition,
    ContainerActions: containerProps => (
      <WidgetContainerActions
        {...containerProps}
        eventView={widgetEventView}
        allowedCharts={allowedCharts}
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
    'withStaticFilters',
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
  eventView,
  setChartSetting,
  allowedCharts,
  rowChartSettings,
}: {
  allowedCharts: PerformanceWidgetSetting[];
  chartSetting: PerformanceWidgetSetting;
  eventView: EventView;
  rowChartSettings: PerformanceWidgetSetting[];
  setChartSetting: (setting: PerformanceWidgetSetting) => void;
}) => {
  const organization = useOrganization();
  const menuOptions: React.ComponentProps<
    typeof CompositeSelect
  >['sections'][number]['options'] = [];

  const settingsMap = WIDGET_DEFINITIONS({organization});
  for (const setting of allowedCharts) {
    const options = settingsMap[setting];
    menuOptions.push({
      value: setting,
      label: options.title,
      disabled: setting !== chartSetting && rowChartSettings.includes(setting),
    });
  }

  const chartDefinition = WIDGET_DEFINITIONS({organization})[chartSetting];

  function handleWidgetActionChange(value) {
    if (value === 'open_in_discover') {
      browserHistory.push(getEventViewDiscoverPath(organization, eventView));
    }
  }

  return (
    <CompositeSelect
      sections={
        [
          {
            label: t('Display'),
            options: menuOptions,
            value: chartSetting,
            onChange: setChartSetting,
          },
          chartDefinition.allowsOpenInDiscover
            ? {
                label: t('Other'),
                options: [{label: t('Open in Discover'), value: 'open_in_discover'}],
                value: '',
                onChange: handleWidgetActionChange,
              }
            : null,
        ].filter(Boolean) as React.ComponentProps<typeof CompositeSelect>['sections']
      }
      trigger={triggerProps => (
        <DropdownButton
          {...triggerProps}
          size="xs"
          borderless
          showChevron={false}
          icon={<IconEllipsis aria-label={t('More')} />}
        />
      )}
      position="bottom-end"
    />
  );
};

const getEventViewDiscoverPath = (
  organization: Organization,
  eventView: EventView
): string => {
  const discoverUrlTarget = eventView.getResultsViewUrlTarget(organization.slug);

  // The landing page EventView has some additional conditions, but
  // `EventView#getResultsViewUrlTarget` omits those! Get them manually
  discoverUrlTarget.query.query = eventView.getQueryWithAdditionalConditions();

  return `${discoverUrlTarget.pathname}?${qs.stringify(
    omit(discoverUrlTarget.query, ['widths']) // Column widths are not useful in this case
  )}`;
};

/**
 * Constructs an `EventView` that matches a widget's chart definition.
 * @param baseEventView Any valid event view. The easiest way to make a new EventView is to clone an existing one, because `EventView#constructor` takes too many abstract arguments
 * @param chartDefinition
 */
const makeEventViewForWidget = (
  baseEventView: EventView,
  chartDefinition: ChartDefinition
): EventView => {
  const widgetEventView = baseEventView.clone();
  widgetEventView.name = chartDefinition.title;
  widgetEventView.yAxis = chartDefinition.fields[0]; // All current widgets only have one field
  widgetEventView.display = DisplayModes.PREVIOUS;
  widgetEventView.fields = ['transaction', 'project', ...chartDefinition.fields].map(
    fieldName => ({field: fieldName} as Field)
  );

  return widgetEventView;
};

const WidgetContainer = withOrganization(_WidgetContainer);

export default WidgetContainer;
