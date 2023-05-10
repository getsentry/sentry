import {useTheme} from '@emotion/react';
import isNil from 'lodash/isNil';
import moment from 'moment';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {getSegmentLabel} from 'sentry/views/starfish/components/breakdownBar';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  ModuleButtonType,
  ModuleLinkButton,
} from 'sentry/views/starfish/views/webServiceView/moduleLinkButton';

export function WebServiceBreakdownChart({
  isTopDataLoading,
  topData,
  isOtherDataLoading,
  otherData,
  throughputData,
}) {
  const theme = useTheme();
  const seriesByDomain: {[module: string]: Series} = {};
  let start: moment.Moment | undefined = undefined;
  let end: moment.Moment | undefined = undefined;
  if (!isTopDataLoading && !isOtherDataLoading) {
    topData.forEach(series => {
      const label = getSegmentLabel(series.span_operation, series.action, series.domain);
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

  const button = <ModuleLinkButton type={ModuleButtonType.API} />;

  return (
    <ChartPanel title={t('p75 of HTTP spans')} button={button}>
      <Chart
        statsPeriod="24h"
        height={180}
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
        throughput={throughputData}
      />
    </ChartPanel>
  );
}
