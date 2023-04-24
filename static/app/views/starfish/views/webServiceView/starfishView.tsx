import {Fragment, useState} from 'react';
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
  ModuleButtonType,
  ModuleLinkButton,
} from 'sentry/views/starfish/views/webServiceView/moduleLinkButton';
import {MODULE_DURATION_QUERY} from 'sentry/views/starfish/views/webServiceView/queries';

const EventsRequest = withApi(_EventsRequest);

import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {insertClickableAreasIntoSeries} from 'sentry/views/starfish/utils/insertClickableAreasIntoSeries';
import {EndpointDataRow} from 'sentry/views/starfish/views/webServiceView/endpointDetails';
import FailureDetailPanel from 'sentry/views/starfish/views/webServiceView/panel';

import EndpointList from './endpointList';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
  organization: Organization;
  projects: Project[];
};

const HOST = 'http://localhost:8080';

const handleClose = () => {};

export function StarfishView(props: BasePerformanceViewProps) {
  const {organization, eventView, onSelect} = props;
  const theme = useTheme();
  const [selectedSpike, setSelectedSpike] = useState<any | undefined>();

  const {isLoading: isDurationDataLoading, data: moduleDurationData} = useQuery({
    queryKey: ['durationBreakdown'],
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

  moduleDurationData.forEach(value => {
    seriesByModule[value.module].data.push({value: value.p75, name: value.interval});
  });

  const data = Object.values(seriesByModule).map(series =>
    zeroFillSeries(series, moment.duration(12, 'hours'))
  );

  function renderFailureRateChart() {
    const query = new MutableSearch(['event.type:transaction']);

    return (
      <EventsRequest
        query={query.formatString()}
        includePrevious={false}
        partial
        interval="1h"
        includeTransformedData
        limit={1}
        environment={eventView.environment}
        project={eventView.project}
        period={eventView.statsPeriod}
        referrer="starfish-homepage-failure-rate"
        start={eventView.start}
        end={eventView.end}
        organization={organization}
        yAxis="equation|count_if(http.status_code,greaterOrEquals,500)/(count_if(http.status_code,equals,200)+count_if(http.status_code,greaterOrEquals,500))"
      >
        {eventData => {
          const transformedData: Series[] | undefined = eventData.timeseriesData?.map(
            series => ({
              data: series.data,
              seriesName: t('Failure Rate'),
              color: CHART_PALETTE[5][3],
            })
          );

          if (!transformedData) {
            return null;
          }

          insertClickableAreasIntoSeries(transformedData, theme.red300);

          return (
            <FailureRateChart
              statsPeriod={eventView.statsPeriod}
              height={180}
              data={transformedData}
              start={eventView.start as string}
              end={eventView.end as string}
              loading={eventData.loading}
              utc={false}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '8px',
              }}
              handleSpikeAreaClick={e =>
                e.componentType === 'markArea' && setSelectedSpike(e)
              }
            />
          );
        }}
      </EventsRequest>
    );
  }

  return (
    <div data-test-id="starfish-view">
      <FailureDetailPanel onClose={handleClose} spikeObject={selectedSpike} />
      <ModuleLinkButton type={ModuleButtonType.API} />
      <ModuleLinkButton type={ModuleButtonType.CACHE} />
      <ModuleLinkButton type={ModuleButtonType.DB} />
      <StyledRow minSize={200}>
        <Fragment>
          <ChartPanel title={t('Response Time')}>
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
          </ChartPanel>
          {renderFailureRateChart()}
        </Fragment>
      </StyledRow>

      <EndpointList
        {...props}
        setError={usePageError().setPageError}
        dataset="discover" // Metrics dataset can't do total.transaction_duration yet
        onSelect={onSelect}
        columnTitles={[
          'endpoint',
          'tpm',
          'p50(duration)',
          'p95(duration)',
          'failure count',
          'cumulative time',
        ]}
      />
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;
