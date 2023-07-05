import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {LineChartSeries} from 'sentry/components/charts/lineChart';
import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import useOrganization from 'sentry/utils/useOrganization';
import Chart from 'sentry/views/starfish/components/chart';
import {
  DataDisplayType,
  DataRow,
} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

type Props = {
  colorPalette: string[];
  dataDisplayType: DataDisplayType;
  isCumulativeTimeLoading: boolean;
  isTableLoading: boolean;
  isTimeseriesLoading: boolean;
  options: SelectOption<DataDisplayType>[];
  setDataDisplayType: any;
  tableData: DataRow[];
  topSeriesData: LineChartSeries[];
  totalCumulativeTime: number;
  errored?: boolean;
  transaction?: string;
};

export function SpanGroupBreakdown({
  topSeriesData: data,
  transaction,
  isTimeseriesLoading,
  errored,
  options,
  dataDisplayType,
  setDataDisplayType,
}: Props) {
  const organization = useOrganization();
  const hasDropdownFeatureFlag = organization.features.includes(
    'starfish-wsv-chart-dropdown'
  );

  const visibleSeries: LineChartSeries[] = [];

  for (let index = 0; index < data.length; index++) {
    const series = data[index];
    series.emphasis = {
      disabled: false,
      focus: 'series',
    };
    series.blur = {
      areaStyle: {opacity: 0.3},
    };
    series.triggerLineEvent = true;
    visibleSeries.push(series);
  }

  const dataAsPercentages = cloneDeep(visibleSeries);
  const numDataPoints = data[0]?.data?.length ?? 0;
  for (let i = 0; i < numDataPoints; i++) {
    const totalTimeAtIndex = data.reduce((acc, datum) => acc + datum.data[i].value, 0);
    dataAsPercentages.forEach(segment => {
      const clone = {...segment.data[i]};
      clone.value = clone.value / totalTimeAtIndex;
      segment.data[i] = clone;
    });
  }

  const handleChange = (option: SelectOption<DataDisplayType>) => {
    setDataDisplayType(option.value);
    trackAnalytics('starfish.web_service_view.breakdown.display_change', {
      organization,
      display: option.value,
    });
  };

  const handleModuleAreaClick = event => {
    switch (event.seriesName) {
      case 'http':
        browserHistory.push('/starfish/api');
        break;
      case 'db':
        browserHistory.push('/starfish/database');
        break;
      case 'custom':
      case 'Other':
      case 'cache':
      default:
        browserHistory.push('/starfish/spans');
        break;
    }
  };

  return (
    <FlexRowContainer>
      <ChartPadding>
        <Header>
          <ChartLabel>
            {transaction ? t('Endpoint Breakdown') : t('Service Breakdown')}
          </ChartLabel>
          {hasDropdownFeatureFlag && (
            <CompactSelect
              options={options}
              value={dataDisplayType}
              onChange={handleChange}
            />
          )}
        </Header>
        <Chart
          statsPeriod="24h"
          height={340}
          showLegend
          data={dataDisplayType === DataDisplayType.PERCENTAGE ? dataAsPercentages : data}
          dataMax={dataDisplayType === DataDisplayType.PERCENTAGE ? 1 : undefined}
          durationUnit={dataDisplayType === DataDisplayType.PERCENTAGE ? 0.25 : undefined}
          start=""
          end=""
          errored={errored}
          loading={isTimeseriesLoading}
          utc={false}
          onClick={handleModuleAreaClick}
          grid={{
            left: '0',
            right: '0',
            top: '20px',
            bottom: '0',
          }}
          definedAxisTicks={6}
          stacked
          aggregateOutputFormat={
            dataDisplayType === DataDisplayType.PERCENTAGE ? 'percentage' : 'duration'
          }
          tooltipFormatterOptions={{
            valueFormatter: value =>
              tooltipFormatterUsingAggregateOutputType(value, 'percentage'),
          }}
          onLegendSelectChanged={event => {
            trackAnalytics('starfish.web_service_view.breakdown.legend_change', {
              organization,
              selected: Object.keys(event.selected).filter(key => event.selected[key]),
              toggled: event.name,
            });
          }}
        />
      </ChartPadding>
    </FlexRowContainer>
  );
}

const ChartPadding = styled('div')`
  padding: 0 ${space(2)};
  flex: 2;
`;

const ChartLabel = styled('p')`
  ${p => p.theme.text.cardTitle}
`;

const Header = styled('div')`
  padding: 0 ${space(1)} 0 0;
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const FlexRowContainer = styled('div')`
  display: flex;
  min-height: 200px;
  padding-bottom: ${space(2)};
`;
