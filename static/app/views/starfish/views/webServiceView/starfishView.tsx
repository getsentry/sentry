import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {useQuery} from 'sentry/utils/queryClient';
import Chart from 'sentry/views/starfish/components/chart';
import {MODULE_DURATION_QUERY} from 'sentry/views/starfish/views/webServiceView/queries';

import EndpointList from './endpointList';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
};

const HOST = 'http://localhost:8080';

export function StarfishView(props: BasePerformanceViewProps) {
  // const {organization, eventView} = props;

  const {isLoading: isDurationDataLoading, data: moduleDurationData} = useQuery({
    queryKey: ['graph'],
    queryFn: () =>
      fetch(`${HOST}/?query=${MODULE_DURATION_QUERY}`).then(res => res.json()),
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

  // Attempt at zerofilling data so that the charts stack properly and
  // don't look like abstract art. Only works if the primary orderby
  // is timestamp.
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
          '% time spent',
        ]}
      />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;
