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
import {
  OTHER_DOMAINS,
  TOP_DOMAINS,
} from 'sentry/views/starfish/views/webServiceView/queries';

const EventsRequest = withApi(_EventsRequest);

import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';

import {normalizeDateTimeString} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {PERIOD_REGEX} from 'sentry/views/starfish/modules/APIModule/queries';
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
  const {organization, eventView, onSelect, location} = props;
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const [selectedSpike, setSelectedSpike] = useState<any | undefined>();

  const {isLoading: isDurationDataLoading, data: moduleDurationData} = useQuery({
    queryKey: ['topDomains'],
    queryFn: () => fetch(`${HOST}/?query=${TOP_DOMAINS}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isOtherDurationDataLoading, data: moduleOtherDurationData} = useQuery(
    {
      queryKey: ['otherDomains'],
      queryFn: () => fetch(`${HOST}/?query=${OTHER_DOMAINS}`).then(res => res.json()),
      retry: false,
      initialData: [],
    }
  );

  const seriesByModule: {[module: string]: Series} = {};
  if (!isDurationDataLoading && !isOtherDurationDataLoading) {
    moduleDurationData.forEach(series => {
      seriesByModule[series.domain] = {
        seriesName: `${series.domain}`,
        data: [],
      };
    });

    moduleDurationData.forEach(value => {
      seriesByModule[value.domain].data.push({value: value.p75, name: value.interval});
    });

    seriesByModule.Other = {
      seriesName: `Other`,
      data: [],
    };

    moduleOtherDurationData.forEach(value => {
      seriesByModule.Other.data.push({value: value.p75, name: value.interval});
    });
  }

  // TODO: Add to a util instead, copied from APIModuleView
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const start =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const end = moment(pageFilter.selection.datetime.end ?? undefined);

  const data = Object.values(seriesByModule).map(series =>
    zeroFillSeries(series, moment.duration(1, 'day'), start, end)
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
              silent: true,
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
              handleSpikeAreaClick={e => {
                if (e.componentType === 'markArea') {
                  setSelectedSpike(e);
                  const startTime = new Date(e.data.coord[0][0]);
                  const endTime = new Date(e.data.coord[1][0]);
                  browserHistory.push({
                    pathname: `${location.pathname}failure-detail/`,
                    query: {
                      start: normalizeDateTimeString(startTime),
                      end: normalizeDateTimeString(endTime),
                      project: decodeList(location.query.project),
                    },
                  });
                }
              }}
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
          <ChartPanel title={t('p75 of Time Spent in HTTP Operations')}>
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
