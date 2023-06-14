import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSegmentLabel} from 'sentry/views/starfish/components/breakdownBar';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export function WebServiceBreakdownChart({
  segments,
  isTopDataLoading,
  topData,
  isOtherDataLoading,
  otherData,
  cumulativeSummary,
}) {
  const pageFilter = usePageFilters();
  const theme = useTheme();
  const seriesByDomain: {[module: string]: Series} = {};
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const start =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const end = moment(pageFilter.selection.datetime.end ?? undefined);

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
      seriesByDomain[
        getSegmentLabel(value.span_operation, value.action, value.domain)
      ].data.push({value: value.p75, name: value.interval});
    });

    seriesByDomain.Other = {
      seriesName: `Other`,
      data: [],
    };

    otherData.forEach(value => {
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
