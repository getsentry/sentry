import {useState} from 'react';
import styled from '@emotion/styled';

import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';
import HistogramQuery from 'app/utils/performance/histogram/histogramQuery';
import withOrganization from 'app/utils/withOrganization';
import ContextMenu from 'app/views/dashboardsV2/contextMenu';

import {getTermHelp, PERFORMANCE_TERM} from '../../data';
import {Chart as _HistogramChart} from '../chart/histogramChart';

import GenericPerformanceWidget, {
  GenericPerformanceWidgetDataType,
} from './genericPerformanceWidget';
import {ChartRowProps} from './miniChartRow';

type Props = {
  index: number;
  organization: Organization;
  defaultChartSetting: ChartSettingType;
} & ChartRowProps;

type ForwardedProps = Omit<Props, 'organization' | 'chartSetting' | 'index'> & {
  orgSlug: string;
};

export enum ChartSettingType {
  LCP_HISTOGRAM = 'lcp_histogram',
  FCP_HISTOGRAM = 'fcp_histogram',
}

interface ChartSetting {
  title: string;
  titleTooltip: string;
  chartField: string;
  dataType: GenericPerformanceWidgetDataType;
}

const getContainerLocalStorageKey = (index: number) => `mini-chart-container#${index}`;
const getChartSetting = (
  index: number,
  defaultType: ChartSettingType
): ChartSettingType => {
  const key = getContainerLocalStorageKey(index);
  const value = localStorage.getItem(key);
  if (value && Object.values(ChartSettingType).includes(value as ChartSettingType)) {
    const _value: ChartSettingType = value as ChartSettingType;
    return _value;
  }
  return defaultType;
};
const _setChartSetting = (index: number, setting: ChartSettingType) => {
  const key = getContainerLocalStorageKey(index);
  localStorage.setItem(key, setting);
};

const CHART_SETTING_OPTIONS: ({
  organization: Organization,
}) => Record<ChartSettingType, ChartSetting> = ({
  organization,
}: {
  organization: Organization;
}) => ({
  [ChartSettingType.LCP_HISTOGRAM]: {
    title: t('LCP Distribution'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    chartField: 'measurements.lcp',
    dataType: GenericPerformanceWidgetDataType.histogram,
  },
  [ChartSettingType.FCP_HISTOGRAM]: {
    title: t('FCP Distribution'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    chartField: 'measurements.fcp',
    dataType: GenericPerformanceWidgetDataType.histogram,
  },
});

const _MiniChartContainer = ({organization, index, ...rest}: Props) => {
  const _chartSetting = getChartSetting(index, rest.defaultChartSetting);
  const [chartSetting, setChartSettingState] = useState(_chartSetting);

  const setChartSetting = (setting: ChartSettingType) => {
    _setChartSetting(index, setting);
    setChartSettingState(setting);
  };
  const onFilterChange = () => {};

  const chartSettingOptions = CHART_SETTING_OPTIONS({organization})[chartSetting];

  const queryProps: ForwardedProps = {
    ...rest,
    orgSlug: organization.slug,
  };

  return (
    <GenericPerformanceWidget
      chartHeight={160}
      {...chartSettingOptions}
      HeaderActions={provided => (
        <ChartContainerActions
          {...provided}
          {...rest}
          organization={organization}
          setChartSetting={setChartSetting}
        />
      )}
      Query={provided => <HistogramQuery {...provided} {...queryProps} numBuckets={20} />}
      Chart={provided => <HistogramChart {...provided} onFilterChange={onFilterChange} />}
    />
  );
};

const ChartContainerActions = ({
  organization,
  setChartSetting,
}: {
  loading: boolean;
  organization: Organization;
  setChartSetting: (setting: ChartSettingType) => void;
}) => {
  const menuOptions: React.ReactNode[] = [];

  const settingsMap = CHART_SETTING_OPTIONS({organization});
  for (const _setting in ChartSettingType) {
    const setting: ChartSettingType = ChartSettingType[_setting] as ChartSettingType;

    const options = settingsMap[setting];
    menuOptions.push(
      <MenuItem key={_setting} onClick={() => setChartSetting(setting)}>
        {t(options.title)}
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

const HistogramChart = styled(_HistogramChart)`
  & .Container {
    padding-bottom: 0px;
  }
`;

const MiniChartContainer = withOrganization(_MiniChartContainer);

export default MiniChartContainer;
