import {useState} from 'react';
import styled from '@emotion/styled';

import MenuItem from 'app/components/menuItem';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';
import {useCurrentPerformanceType} from 'app/utils/performance/contexts/currentPerformanceView';
import {useOrganization} from 'app/utils/useOrganization';
import withOrganization from 'app/utils/withOrganization';
import ContextMenu from 'app/views/dashboardsV2/contextMenu';
import {PROJECT_PERFORMANCE_TYPE} from 'app/views/performance/utils';

import {GenericPerformanceWidgetDataType} from '../types';
import {PerformanceWidgetSetting, WIDGET_DEFINITIONS} from '../widgetDefinitions';
import {HistogramWidget} from '../widgets/histogramWidget';
import {LineChartListWidget} from '../widgets/lineChartListWidget';
import {SingleFieldAreaWidget} from '../widgets/singleFieldAreaWidget';
import {TrendsWidget} from '../widgets/trendsWidget';
import {VitalWidget} from '../widgets/vitalWidget';

import {ChartRowProps} from './widgetChartRow';

type Props = {
  index: number;
  organization: Organization;
  defaultChartSetting: PerformanceWidgetSetting;
  allowedCharts: PerformanceWidgetSetting[];
  chartHeight: number;
  chartColor?: string;
  forceDefaultChartSetting?: boolean; // Used for testing.
} & ChartRowProps;

// Use local storage for chart settings for now.
const getContainerLocalStorageObjectKey = 'landing-chart-container';
const getContainerKey = (
  index: number,
  performanceType: PROJECT_PERFORMANCE_TYPE,
  height: number
) => `landing-chart-container#${performanceType}#${height}#${index}`;

const getChartSetting = (
  index: number,
  height: number,
  performanceType: PROJECT_PERFORMANCE_TYPE,
  defaultType: PerformanceWidgetSetting,
  forceDefaultChartSetting?: boolean // Used for testing.
): PerformanceWidgetSetting => {
  if (forceDefaultChartSetting) {
    return defaultType;
  }
  const key = getContainerKey(index, performanceType, height);
  const localObject = JSON.parse(
    localStorage.getItem(getContainerLocalStorageObjectKey) || '{}'
  );
  const value = localObject?.[key];

  if (
    value &&
    Object.values(PerformanceWidgetSetting).includes(value as PerformanceWidgetSetting)
  ) {
    const _value: PerformanceWidgetSetting = value as PerformanceWidgetSetting;
    return _value;
  }
  return defaultType;
};
const _setChartSetting = (
  index: number,
  height: number,
  performanceType: PROJECT_PERFORMANCE_TYPE,
  setting: PerformanceWidgetSetting
) => {
  const key = getContainerKey(index, performanceType, height);
  const localObject = JSON.parse(
    localStorage.getItem(getContainerLocalStorageObjectKey) || '{}'
  );
  localObject[key] = setting;

  localStorage.setItem(getContainerLocalStorageObjectKey, JSON.stringify(localObject));
};

const _WidgetContainer = (props: Props) => {
  const {organization, index, chartHeight, allowedCharts, ...rest} = props;
  const performanceType = useCurrentPerformanceType();
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
  };

  const widgetProps = {
    chartSetting,
    ...WIDGET_DEFINITIONS({organization})[chartSetting],
    ContainerActions: containerProps => (
      <WidgetContainerActions
        {...containerProps}
        allowedCharts={props.allowedCharts}
        setChartSetting={setChartSetting}
      />
    ),
  };

  switch (widgetProps.dataType) {
    case GenericPerformanceWidgetDataType.trends:
      return <TrendsWidget {...props} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.area:
      return <SingleFieldAreaWidget {...props} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.vitals:
      return <VitalWidget {...props} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.line_list:
      return <LineChartListWidget {...props} {...widgetProps} />;
    case GenericPerformanceWidgetDataType.histogram:
      return <HistogramWidget {...props} {...widgetProps} />;
    default:
      throw new Error(`Widget type "${widgetProps.dataType}" has no implementation.`);
  }
};

export const WidgetContainerActions = ({
  setChartSetting,
  allowedCharts,
}: {
  loading: boolean;
  setChartSetting: (setting: PerformanceWidgetSetting) => void;
  allowedCharts: PerformanceWidgetSetting[];
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
        data-test-id="performance-widget-menu-item"
      >
        {options.title}
      </MenuItem>
    );
  }

  return (
    <ChartActionContainer>
      <ContextMenu>{menuOptions}</ContextMenu>
    </ChartActionContainer>
  );
};

const ChartActionContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const WidgetContainer = withOrganization(_WidgetContainer);

export default WidgetContainer;
