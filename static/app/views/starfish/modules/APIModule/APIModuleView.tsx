import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import moment from 'moment';

import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

import EndpointTable from './endpointTable';
import {ENDPOINT_GRAPH_QUERY} from './queries';

export const HOST = 'http://localhost:8080';

type Props = {
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
};

export type DataRow = {
  count: number;
  description: string;
  domain: string;
};

export default function APIModuleView({location, onSelect}: Props) {
  const {isLoading: isGraphLoading, data: graphData} = useQuery({
    queryKey: ['graph'],
    queryFn: () =>
      fetch(`${HOST}/?query=${ENDPOINT_GRAPH_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const quantiles = ['p50', 'p75', 'p95', 'p99'];

  const seriesByQuantile: {[quantile: string]: Series} = {};
  quantiles.forEach(quantile => {
    seriesByQuantile[quantile] = {
      seriesName: quantile,
      data: [],
    };
  });

  graphData.forEach(datum => {
    quantiles.forEach(quantile => {
      seriesByQuantile[quantile].data.push({
        value: datum[quantile],
        name: datum.interval,
      });
    });
  });

  const data = Object.values(seriesByQuantile).map(series =>
    zeroFillSeries(series, moment.duration(12, 'hours'))
  );

  return (
    <Fragment>
      <ChartPanel title={t('Response Time')}>
        <Chart
          statsPeriod="24h"
          height={180}
          data={data}
          start=""
          end=""
          loading={isGraphLoading}
          utc={false}
          grid={{
            left: '0',
            right: '0',
            top: '16px',
            bottom: '8px',
          }}
          disableMultiAxis
          definedAxisTicks={4}
          stacked
        />
      </ChartPanel>

      <EndpointTable location={location} onSelect={onSelect} />
    </Fragment>
  );
}
