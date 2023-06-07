import {useEffect, useState} from 'react';
import {Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Checkbox from 'sentry/components/checkbox';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {getUtcDateString} from 'sentry/utils/dates';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import {RightAlignedCell} from 'sentry/views/performance/landing/widgets/components/selectableList';
import Chart from 'sentry/views/starfish/components/chart';
import {DataRow} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

type Props = {
  colorPalette: string[];
  initialShowSeries: boolean[];
  isTableLoading: boolean;
  tableData: DataRow[];
  topSeriesData: Series[];
  totalCumulativeTime: number;
};

export function SpanGroupBreakdown({
  tableData: transformedData,
  totalCumulativeTime: totalValues,
  topSeriesData: data,
  initialShowSeries,
}: Props) {
  const {selection} = usePageFilters();
  const theme = useTheme();
  const [showSeriesArray, setShowSeriesArray] = useState<boolean[]>(initialShowSeries);

  useEffect(() => {
    setShowSeriesArray(initialShowSeries);
  }, [initialShowSeries]);

  const visibleSeries: Series[] = [];

  for (let index = 0; index < data.length; index++) {
    const series = data[index];
    if (showSeriesArray[index]) {
      visibleSeries.push(series);
    }
  }
  const colorPalette = theme.charts.getColorPalette(transformedData.length - 2);

  return (
    <FlexRowContainer>
      <ChartPadding>
        <Header>
          <ChartLabel>{t('App Time Breakdown (P95)')}</ChartLabel>
        </Header>
        <Chart
          statsPeriod="24h"
          height={210}
          data={visibleSeries}
          start=""
          end=""
          loading={false}
          utc={false}
          grid={{
            left: '0',
            right: '0',
            top: '8px',
            bottom: '0',
          }}
          definedAxisTicks={6}
          stacked
          aggregateOutputFormat="duration"
          tooltipFormatterOptions={{
            valueFormatter: value =>
              tooltipFormatterUsingAggregateOutputType(value, 'duration'),
          }}
        />
      </ChartPadding>
      <ListContainer>
        {transformedData.map((row, index) => {
          const checkedValue = showSeriesArray[index];
          const group = row.group;
          const {start, end, utc, period} = selection.datetime;
          const spansLinkQueryParams =
            start && end
              ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
              : {statsPeriod: period};
          if (['db', 'http'].includes(group['span.category'])) {
            spansLinkQueryParams['span.module'] = group['span.category'];
          }

          const spansLink =
            group['span.category'] === 'Other'
              ? `/starfish/spans/`
              : `/starfish/spans/?${qs.stringify(spansLinkQueryParams)}`;
          return (
            <StyledLineItem key={`${group['span.category']}`}>
              <ListItemContainer>
                <Checkbox
                  size="sm"
                  checkboxColor={colorPalette[index]}
                  inputCss={{backgroundColor: 'red'}}
                  checked={checkedValue}
                  onChange={() => {
                    const updatedSeries = [...showSeriesArray];
                    updatedSeries[index] = !checkedValue;
                    setShowSeriesArray(updatedSeries);
                  }}
                />
                <TextAlignLeft>
                  <Link to={spansLink}>
                    <TextOverflow>{group['span.category']}</TextOverflow>
                  </Link>
                </TextAlignLeft>
                <RightAlignedCell>
                  <Tooltip
                    title={t(
                      '%s time spent on %s',
                      formatPercentage(row.cumulativeTime / totalValues, 1),
                      group['span.category']
                    )}
                    containerDisplayMode="block"
                    position="top"
                  >
                    <NumberContainer
                      style={{textDecoration: 'underline', textDecorationStyle: 'dotted'}}
                    >
                      {formatPercentage(row.cumulativeTime / totalValues, 1)}
                    </NumberContainer>
                  </Tooltip>
                </RightAlignedCell>
              </ListItemContainer>
            </StyledLineItem>
          );
        })}
      </ListContainer>
    </FlexRowContainer>
  );
}

const StyledLineItem = styled('li')`
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const ListItemContainer = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ListContainer = styled('ul')`
  padding: ${space(1)} 0 0 0;
  margin: 0;
  border-left: 1px solid ${p => p.theme.border};
  list-style-type: none;
`;

const TextAlignLeft = styled('span')`
  text-align: left;
  width: 100%;
  padding: 0 ${space(1.5)};
`;

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
