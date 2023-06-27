import {useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import useOrganization from 'sentry/utils/useOrganization';
import Chart from 'sentry/views/starfish/components/chart';
import {DataRow} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

type Props = {
  colorPalette: string[];
  isCumulativeTimeLoading: boolean;
  isTableLoading: boolean;
  isTimeseriesLoading: boolean;
  tableData: DataRow[];
  topSeriesData: Series[];
  totalCumulativeTime: number;
  errored?: boolean;
  transaction?: string;
};

export enum DataDisplayType {
  CUMULATIVE_DURATION = 'cumulative_duration',
  PERCENTAGE = 'percentage',
}

export function SpanGroupBreakdown({
  tableData: transformedData,
  topSeriesData: data,
  transaction,
  isTimeseriesLoading,
  errored,
}: Props) {
  const organization = useOrganization();
  const [showSeriesArray, setShowSeriesArray] = useState<boolean[]>([]);
  const options: SelectOption<DataDisplayType>[] = [
    {label: 'Total Duration', value: DataDisplayType.CUMULATIVE_DURATION},
    {label: 'Percentages', value: DataDisplayType.PERCENTAGE},
  ];
  const [dataDisplayType, setDataDisplayType] = useState<DataDisplayType>(
    DataDisplayType.CUMULATIVE_DURATION
  );

  const hasDropdownFeatureFlag = organization.features.includes(
    'starfish-wsv-chart-dropdown'
  );

  if (showSeriesArray.length === 0 && transformedData.length > 0) {
    setShowSeriesArray(transformedData.map(() => true));
  }

  const visibleSeries: Series[] = [];

  for (let index = 0; index < data.length; index++) {
    const series = data[index];
    if (showSeriesArray[index]) {
      visibleSeries.push(series);
    }
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
            {transaction ? t('Endpoint Time Breakdown') : t('Service Breakdown')}
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
            top: '8px',
            bottom: '0',
          }}
          definedAxisTicks={6}
          stacked
          aggregateOutputFormat={
            dataDisplayType === DataDisplayType.PERCENTAGE ? 'percentage' : 'duration'
          }
          tooltipFormatterOptions={{
            valueFormatter: value =>
              tooltipFormatterUsingAggregateOutputType(value, 'duration'),
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
`;

const FlexRowContainer = styled('div')`
  display: flex;
  min-height: 200px;
  padding-bottom: ${space(2)};
`;
