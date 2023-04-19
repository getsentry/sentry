import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {useQuery} from 'sentry/utils/queryClient';
import Chart from 'sentry/views/starfish/components/chart';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import FailureRateChart from 'sentry/views/starfish/views/webServiceView/failureRateChart';
import {
  FAILURE_RATE_QUERY,
  MODULE_DURATION_QUERY,
} from 'sentry/views/starfish/views/webServiceView/queries';

import EndpointList from './endpointList';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
};

const HOST = 'http://localhost:8080';

export function StarfishView(props: BasePerformanceViewProps) {
  const {eventView} = props;

  const {isLoading: isDurationDataLoading, data: moduleDurationData} = useQuery({
    queryKey: ['durationBreakdown'],
    queryFn: () =>
      fetch(`${HOST}/?query=${MODULE_DURATION_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isFailureRateDataLoading, data: failureRateData} = useQuery({
    queryKey: ['failureRate'],
    queryFn: () => fetch(`${HOST}/?query=${FAILURE_RATE_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const modules = ['db', 'cache', 'http'];

  const seriesByModule: {[module: string]: Series} = {};
  modules.forEach(module => {
    seriesByModule[module] = {
      seriesName: `p75(${module})`,
      data: [],
    };
  });

  // cross-reference the series, and makes sure
  // they have the same number of points by backfilling
  // missing timestamps for each other series with a 0
  let lastInterval = undefined;
  modules.forEach(module => {
    moduleDurationData.forEach(value => {
      if (module === value.module) {
        if (lastInterval === value.interval) {
          seriesByModule[module].data.pop();
        }
        seriesByModule[module].data.push({
          value: value.p75,
          name: value.interval,
        });
      } else {
        if (lastInterval !== value.interval) {
          seriesByModule[module].data.push({
            value: 0,
            name: value.interval,
          });
        }
      }
      lastInterval = value.interval;
    });
  });

  const data = Object.values(seriesByModule);

  const failureRateSeries = zeroFillSeries(
    {
      seriesName: 'Failure Rate',
      color: CHART_PALETTE[5][3],
      data: failureRateData.map(entry => ({
        value: entry.failureRate,
        name: entry.interval,
      })),
    },
    moment.duration(5, 'minutes')
  );

  return (
    <div data-test-id="starfish-view">
      <StyledRow minSize={200}>
        <Fragment>
          <Chart
            statsPeriod="24h"
            height={180}
            data={data}
            start=""
            end=""
            loading={isDurationDataLoading}
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
            chartColors={['#444674', '#7a5088', '#b85586']}
          />

          <FailureRateChart
            statsPeriod={eventView.statsPeriod}
            height={180}
            data={[failureRateSeries]}
            start={eventView.start as string}
            end={eventView.end as string}
            loading={isFailureRateDataLoading}
            utc={false}
            grid={{
              left: '0',
              right: '0',
              top: '16px',
              bottom: '8px',
            }}
          />
        </Fragment>
      </StyledRow>

      <EndpointList
        {...props}
        setError={usePageError().setPageError}
        dataset="discover" // Metrics dataset can't do equations yet
        columnTitles={[
          'endpoint',
          'tpm',
          'p50(duration)',
          'p95(duration)',
          'cumulative time',
        ]}
      />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;
