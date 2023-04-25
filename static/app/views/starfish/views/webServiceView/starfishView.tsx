import {useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import FailureRateChart from 'sentry/views/starfish/views/webServiceView/failureRateChart';
import {
  ModuleButtonType,
  ModuleLinkButton,
} from 'sentry/views/starfish/views/webServiceView/moduleLinkButton';

const EventsRequest = withApi(_EventsRequest);

import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';

import {normalizeDateTimeString} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import {insertClickableAreasIntoSeries} from 'sentry/views/starfish/utils/insertClickableAreasIntoSeries';
import {DatabaseDurationChart} from 'sentry/views/starfish/views/webServiceView/databaseDurationChart';
import {EndpointDataRow} from 'sentry/views/starfish/views/webServiceView/endpointDetails';
import {HttpBreakdownChart} from 'sentry/views/starfish/views/webServiceView/httpBreakdownChart';

import EndpointList from './endpointList';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
  organization: Organization;
  projects: Project[];
};

export function StarfishView(props: BasePerformanceViewProps) {
  const {organization, eventView, onSelect, location} = props;
  const theme = useTheme();
  const [, setSelectedSpike] = useState<any | undefined>();

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
      {/* <FailureDetailPanel onClose={handleClose} spikeObject={selectedSpike} /> */}
      <ModuleLinkButton type={ModuleButtonType.CACHE} />
      <StyledRow minSize={200}>
        <ChartsContainer>
          <ChartsContainerItem>
            <HttpBreakdownChart />
          </ChartsContainerItem>
          <ChartsContainerItem>
            <DatabaseDurationChart />
          </ChartsContainerItem>
          <ChartsContainerItem>{renderFailureRateChart()}</ChartsContainerItem>
        </ChartsContainer>
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

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;
