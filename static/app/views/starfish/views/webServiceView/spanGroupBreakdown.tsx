import {Fragment, useEffect, useState} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Checkbox from 'sentry/components/checkbox';
import Duration from 'sentry/components/duration';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {getUtcDateString} from 'sentry/utils/dates';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {RightAlignedCell} from 'sentry/views/performance/landing/widgets/components/selectableList';
import {getSegmentLabelForTable} from 'sentry/views/starfish/components/breakdownBar';
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

  return (
    <Fragment>
      <ChartPadding>
        <Header>
          <ChartLabel>{'p50 of Span Groups With Highest Cumulative Times'}</ChartLabel>
        </Header>
        <Chart
          statsPeriod="24h"
          height={200}
          data={visibleSeries}
          start=""
          end=""
          loading={false}
          utc={false}
          grid={{
            left: '0',
            right: '0',
            top: '16px',
            bottom: '8px',
          }}
          definedAxisTicks={8}
          stacked
          aggregateOutputFormat="duration"
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
          ['span_operation', 'action', 'domain'].forEach(key => {
            if (group[key] !== undefined && group[key] !== null) {
              spansLinkQueryParams[key] = group[key];
            }
          });

          const spansLink =
            group.module === 'other'
              ? `/starfish/spans/`
              : `/starfish/spans/?${qs.stringify(spansLinkQueryParams)}`;
          return (
            <StyledLineItem
              key={`${group.span_operation}-${group.action}-${group.domain}`}
            >
              <ListItemContainer>
                <StyledTopResultsIndicator
                  count={Math.max(transformedData.length - 1, 1)}
                  index={index}
                />
                <Checkbox
                  size="sm"
                  checked={checkedValue}
                  onChange={() => {
                    const updatedSeries = [...showSeriesArray];
                    updatedSeries[index] = !checkedValue;
                    setShowSeriesArray(updatedSeries);
                  }}
                />
                <TextAlignLeft>
                  <Link to={spansLink}>
                    <TextOverflow>
                      {getSegmentLabelForTable(
                        group.span_operation,
                        group.action,
                        group.domain
                      )}
                    </TextOverflow>
                  </Link>
                </TextAlignLeft>
                <RightAlignedCell>
                  <Tooltip
                    title={t(
                      'This group of spans account for %s of the cumulative time on your web service',
                      formatPercentage(row.cumulativeTime / totalValues, 1)
                    )}
                    containerDisplayMode="block"
                    position="top"
                  >
                    <NumberContainer>
                      {tct('[cumulativeTime] ([cumulativeTimePercentage])', {
                        cumulativeTime: (
                          <Duration
                            seconds={row.cumulativeTime / 1000}
                            fixedDigits={1}
                            abbreviation
                          />
                        ),
                        cumulativeTimePercentage: formatPercentage(
                          row.cumulativeTime / totalValues,
                          1
                        ),
                      })}
                    </NumberContainer>
                  </Tooltip>
                </RightAlignedCell>
              </ListItemContainer>
            </StyledLineItem>
          );
        })}
      </ListContainer>
    </Fragment>
  );
}

const StyledLineItem = styled('li')`
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const ListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ListContainer = styled('ul')`
  padding: ${space(1)} 0 0 0;
  margin: 0;
  list-style-type: none;
`;

const TextAlignLeft = styled('span')`
  text-align: left;
  width: 100%;
  padding: 0 ${space(1.5)};
`;

const ChartPadding = styled('div')`
  padding: 0 ${space(2)};
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

const StyledTopResultsIndicator = styled(TopResultsIndicator)`
  margin-top: 0px;
`;
