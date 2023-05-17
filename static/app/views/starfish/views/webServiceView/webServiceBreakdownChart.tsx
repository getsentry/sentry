import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isNil from 'lodash/isNil';
import moment from 'moment';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {getSegmentLabel} from 'sentry/views/starfish/components/breakdownBar';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export function WebServiceBreakdownChart({
  segments,
  isTopDataLoading,
  topData,
  isOtherDataLoading,
  otherData,
  cumulativeSummary,
}) {
  const theme = useTheme();
  const seriesByDomain: {[module: string]: Series} = {};
  let start: moment.Moment | undefined = undefined;
  let end: moment.Moment | undefined = undefined;
  if (!isTopDataLoading && !isOtherDataLoading && segments.length > 0) {
    segments.forEach(segment => {
      const label = getSegmentLabel(
        segment.span_operation,
        segment.action,
        segment.domain
      );
      seriesByDomain[label] = {
        seriesName: `${label}`,
        data: [],
      };
    });

    topData.forEach(value => {
      if (isNil(start) || moment(value.inteval) < start) {
        start = moment(value.interval);
      }
      if (isNil(end) || moment(value.inteval) > end) {
        end = moment(value.interval);
      }
      seriesByDomain[
        getSegmentLabel(value.span_operation, value.action, value.domain)
      ].data.push({value: value.p75, name: value.interval});
    });

    seriesByDomain.Other = {
      seriesName: `Other`,
      data: [],
    };

    otherData.forEach(value => {
      if (isNil(start) || moment(value.inteval) < start) {
        start = moment(value.interval);
      }
      if (isNil(end) || moment(value.inteval) > end) {
        end = moment(value.interval);
      }
      seriesByDomain.Other.data.push({value: value.p75, name: value.interval});
    });
  }
  const data = Object.values(seriesByDomain).map(series =>
    zeroFillSeries(series, moment.duration(1, 'day'), start, end)
  );

  return (
    <ChartPanel title={t('Duration breakdown (p50)')}>
      <Container>
        <Chart
          statsPeriod="24h"
          height={350}
          data={data}
          start=""
          end=""
          loading={isTopDataLoading}
          utc={false}
          grid={{
            left: '0',
            right: '0',
            top: '16px',
            bottom: '8px',
          }}
          definedAxisTicks={4}
          stacked
          chartColors={theme.charts.getColorPalette(5)}
        />
        {cumulativeSummary}
      </Container>
    </ChartPanel>
  );
}

const Container = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr min-content;
  align-items: center;
  justify-self: flex-end;
  gap: ${space(2)};
`;
