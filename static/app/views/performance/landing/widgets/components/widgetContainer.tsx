import {useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {Field} from 'sentry/utils/discover/fields';
import {DisplayModes} from 'sentry/utils/discover/types';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePerformanceDisplayType} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import {PerformanceScoreListWidget} from 'sentry/views/performance/landing/widgets/widgets/performanceScoreListWidget';
import SlowScreens from 'sentry/views/performance/landing/widgets/widgets/slowScreens';

import {GenericPerformanceWidgetDataType} from '../types';
import {_setChartSetting, filterAllowedChartsMetrics, getChartSetting} from '../utils';
import {
  ChartDefinition,
  PerformanceWidgetSetting,
  WIDGET_DEFINITIONS,
} from '../widgetDefinitions';
import {HistogramWidget} from '../widgets/histogramWidget';
import {LineChartListWidget} from '../widgets/lineChartListWidget';
import {PerformanceScoreWidget} from '../widgets/performanceScoreWidget';
import {SingleFieldAreaWidget} from '../widgets/singleFieldAreaWidget';
import {StackedAreaChartListWidget} from '../widgets/stackedAreaChartListWidget';
import {TrendsWidget} from '../widgets/trendsWidget';
import {VitalWidget} from '../widgets/vitalWidget';

import {ChartRowProps} from './widgetChartRow';

interface Props extends ChartRowProps {
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
}

function trackChartSettingChange(
  previousChartSetting: PerformanceWidgetSetting,
  chartSetting: PerformanceWidgetSetting,
  fromDefault: boolean,
  organization: Organization
) {
  trackAnalytics('performance_views.landingv3.widget.switch', {
    organization,
    from_widget: previousChartSetting,
    to_widget: chartSetting,
    from_default: fromDefault,
    is_new_menu: organization.features.includes('performance-new-widget-designs'),
  });
}

function _WidgetContainer(props: Props) {
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

  const showNewWidgetDesign = organization.features.includes(
    'performance-new-widget-designs'
  );

  const widgetProps = {
    ...chartDefinition,
    chartSetting,
    chartDefinition,
    InteractiveTitle:
      showNewWidgetDesign && allowedCharts.length > 2
        ? containerProps => (
            <WidgetInteractiveTitle
              {...containerProps}
              eventView={widgetEventView}
              allowedCharts={allowedCharts}
              chartSetting={chartSetting}
              setChartSetting={setChartSetting}
              rowChartSettings={rowChartSettings}
            />
          )
        : null,
    ContainerActions: !showNewWidgetDesign
      ? containerProps => (
          <WidgetContainerActions
            {...containerProps}
            eventView={widgetEventView}
            allowedCharts={allowedCharts}
            chartSetting={chartSetting}
            setChartSetting={setChartSetting}
            rowChartSettings={rowChartSettings}
          />
        )
      : null,
  };

  const passedProps = pick(props, [
    'eventView',
    'location',
    'organization',
    'chartHeight',
    'withStaticFilters',
  ]);

  const titleTooltip = showNewWidgetDesign ? '' : widgetProps.titleTooltip;

  switch (widgetProps.dataType) {
    case GenericPerformanceWidgetDataType.TRENDS:
      return (
        <TrendsWidget {...passedProps} {...widgetProps} titleTooltip={titleTooltip} />
      );
    case GenericPerformanceWidgetDataType.AREA:
      return (
        <SingleFieldAreaWidget
          {...passedProps}
          {...widgetProps}
          titleTooltip={titleTooltip}
        />
      );
    case GenericPerformanceWidgetDataType.VITALS:
      return (
        <VitalWidget {...passedProps} {...widgetProps} titleTooltip={titleTooltip} />
      );
    case GenericPerformanceWidgetDataType.LINE_LIST:
      return (
        <LineChartListWidget
          {...passedProps}
          {...widgetProps}
          titleTooltip={titleTooltip}
        />
      );
    case GenericPerformanceWidgetDataType.HISTOGRAM:
      return (
        <HistogramWidget {...passedProps} {...widgetProps} titleTooltip={titleTooltip} />
      );
    case GenericPerformanceWidgetDataType.STACKED_AREA:
      return <StackedAreaChartListWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.PERFORMANCE_SCORE_LIST:
      return <PerformanceScoreListWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.PERFORMANCE_SCORE:
      return <PerformanceScoreWidget {...passedProps} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.SLOW_SCREENS_BY_TTID:
      return <SlowScreens {...passedProps} {...widgetProps} />;
    default:
      throw new Error(`Widget type "${widgetProps.dataType}" has no implementation.`);
  }
}

export function WidgetInteractiveTitle({
  chartSetting,
  eventView,
  setChartSetting,
  allowedCharts,
  rowChartSettings,
}) {
  const organization = useOrganization();
  const menuOptions: SelectOption<string>[] = [];

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

  if (chartDefinition.allowsOpenInDiscover) {
    menuOptions.push({label: t('Open in Discover'), value: 'open_in_discover'});
  }

  const handleChange = option => {
    if (option.value === 'open_in_discover') {
      browserHistory.push(
        normalizeUrl(getEventViewDiscoverPath(organization, eventView))
      );
    } else {
      setChartSetting(option.value);
    }
  };

  return (
    <StyledCompactSelect
      options={menuOptions}
      value={chartSetting}
      onChange={handleChange}
      triggerProps={{borderless: true, size: 'zero'}}
      offset={4}
    />
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  /* Reset font-weight set by HeaderTitleLegend, buttons are already bold and
   * setting this higher up causes it to trickle into the menues */
  font-weight: normal;
  margin: -${space(0.5)} -${space(1)} -${space(0.25)};
  min-width: 0;

  button {
    padding: ${space(0.5)} ${space(1)};
    font-size: ${p => p.theme.fontSizeLarge};
  }
`;

export function WidgetContainerActions({
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
}) {
  const organization = useOrganization();
  const menuOptions: SelectOption<PerformanceWidgetSetting>[] = [];

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
      browserHistory.push(
        normalizeUrl(getEventViewDiscoverPath(organization, eventView))
      );
    }
  }

  return (
    <CompositeSelect
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
    >
      <CompositeSelect.Region
        label={t('Display')}
        options={menuOptions}
        value={chartSetting}
        onChange={opt => setChartSetting(opt.value)}
      />
      {chartDefinition.allowsOpenInDiscover && (
        <CompositeSelect.Region
          label={t('Other')}
          options={[{label: t('Open in Discover'), value: 'open_in_discover'}]}
          value=""
          onChange={opt => handleWidgetActionChange(opt.value)}
        />
      )}
    </CompositeSelect>
  );
}

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
    fieldName => ({field: fieldName}) as Field
  );

  return widgetEventView;
};

const WidgetContainer = withOrganization(_WidgetContainer);

export default WidgetContainer;
