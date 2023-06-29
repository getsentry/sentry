import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
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
  topSeriesData: Series[];
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

  const visibleSeries: Series[] = [];

  for (let index = 0; index < data.length; index++) {
    const series = data[index];
    visibleSeries.push(series);
  }

  // Skip these calculations if the feature flag is not enabled
  let dataAsPercentages;
  if (hasDropdownFeatureFlag) {
    dataAsPercentages = cloneDeep(visibleSeries);
    const numDataPoints = data[0]?.data?.length ?? 0;
    for (let i = 0; i < numDataPoints; i++) {
      const totalTimeAtIndex = data.reduce((acc, datum) => acc + datum.data[i].value, 0);
      dataAsPercentages.forEach(segment => {
        const clone = {...segment.data[i]};
        clone.value = clone.value / totalTimeAtIndex;
        segment.data[i] = clone;
      });
    }
  }

  const handleChange = (option: SelectOption<DataDisplayType>) =>
    setDataDisplayType(option.value);

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
          data={
            dataDisplayType === DataDisplayType.PERCENTAGE
              ? dataAsPercentages
              : visibleSeries
          }
          dataMax={dataDisplayType === DataDisplayType.PERCENTAGE ? 1 : undefined}
          durationUnit={dataDisplayType === DataDisplayType.PERCENTAGE ? 0.25 : undefined}
          start=""
          end=""
          errored={errored}
          loading={isTimeseriesLoading}
          utc={false}
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
