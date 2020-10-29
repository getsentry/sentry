import React from 'react';
import maxBy from 'lodash/maxBy';
import chunk from 'lodash/chunk';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {SeriesDataUnit} from 'app/types/echarts';
import {Panel, PanelBody} from 'app/components/panels';
import Feature from 'app/components/acl/feature';
import EventsRequest from 'app/components/charts/eventsRequest';
import LoadingMask from 'app/components/loadingMask';
import Placeholder from 'app/components/placeholder';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import {IncidentRule, TimeWindow, TimePeriod, Trigger} from '../../types';
import ThresholdsChart from './thresholdsChart';

type Props = {
  api: Client;
  organization: Organization;
  projects: Project[];

  query: IncidentRule['query'];
  timeWindow: IncidentRule['timeWindow'];
  environment: string | null;
  aggregate: IncidentRule['aggregate'];
  triggers: Trigger[];
  resolveThreshold: IncidentRule['resolveThreshold'];
  thresholdType: IncidentRule['thresholdType'];
};

const TIME_PERIOD_MAP: Record<TimePeriod, string> = {
  [TimePeriod.SIX_HOURS]: t('Last 6 hours'),
  [TimePeriod.ONE_DAY]: t('Last 24 hours'),
  [TimePeriod.THREE_DAYS]: t('Last 3 days'),
  [TimePeriod.SEVEN_DAYS]: t('Last 7 days'),
  [TimePeriod.FOURTEEN_DAYS]: t('Last 14 days'),
  [TimePeriod.THIRTY_DAYS]: t('Last 30 days'),
};

/**
 * If TimeWindow is small we want to limit the stats period
 * If the time window is one day we want to use a larger stats period
 */
const AVAILABLE_TIME_PERIODS: Record<TimeWindow, TimePeriod[]> = {
  [TimeWindow.ONE_MINUTE]: [
    TimePeriod.SIX_HOURS,
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
  ],
  [TimeWindow.FIVE_MINUTES]: [
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.TEN_MINUTES]: [
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.FIFTEEN_MINUTES]: [
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.THIRTY_MINUTES]: [
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.ONE_HOUR]: [TimePeriod.FOURTEEN_DAYS, TimePeriod.THIRTY_DAYS],
  [TimeWindow.TWO_HOURS]: [TimePeriod.THIRTY_DAYS],
  [TimeWindow.FOUR_HOURS]: [TimePeriod.THIRTY_DAYS],
  [TimeWindow.ONE_DAY]: [TimePeriod.THIRTY_DAYS],
};

const AGGREGATE_FUNCTIONS = {
  avg: (seriesChunk: SeriesDataUnit[]) =>
    AGGREGATE_FUNCTIONS.sum(seriesChunk) / seriesChunk.length,
  sum: (seriesChunk: SeriesDataUnit[]) =>
    seriesChunk.reduce((acc, series) => acc + series.value, 0),
  max: (seriesChunk: SeriesDataUnit[]) =>
    Math.max(...seriesChunk.map(series => series.value)),
  min: (seriesChunk: SeriesDataUnit[]) =>
    Math.min(...seriesChunk.map(series => series.value)),
};

/**
 * Determines the number of datapoints to roll up
 */
const getBucketSize = (timeWindow: TimeWindow, dataPoints: number): number => {
  const MAX_DPS = 720;
  for (const bucketSize of [5, 10, 15, 30, 60, 120, 240]) {
    const chunkSize = bucketSize / timeWindow;
    if (dataPoints / chunkSize <= MAX_DPS) {
      return bucketSize / timeWindow;
    }
  }

  return 2;
};

type State = {
  statsPeriod: TimePeriod;
};

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends React.PureComponent<Props, State> {
  state: State = {
    statsPeriod: TimePeriod.ONE_DAY,
  };

  handleStatsPeriodChange = (statsPeriod: {value: TimePeriod; label: string}) => {
    this.setState({statsPeriod: statsPeriod.value});
  };

  render() {
    const {
      api,
      organization,
      projects,
      timeWindow,
      query,
      aggregate,
      triggers,
      resolveThreshold,
      thresholdType,
      environment,
    } = this.props;
    const {statsPeriod} = this.state;

    const statsPeriodOptions = AVAILABLE_TIME_PERIODS[timeWindow];
    const period = statsPeriodOptions.includes(statsPeriod)
      ? statsPeriod
      : statsPeriodOptions[0];

    return (
      <Feature features={['metric-alert-builder-aggregate']} organization={organization}>
        {({hasFeature}) => {
          return (
            <EventsRequest
              api={api}
              organization={organization}
              query={query}
              environment={environment ? [environment] : undefined}
              project={projects.map(({id}) => Number(id))}
              interval={`${timeWindow}m`}
              period={period}
              yAxis={aggregate}
              includePrevious={false}
              currentSeriesName={aggregate}
            >
              {({loading, reloading, timeseriesData}) => {
                let maxValue: SeriesDataUnit | undefined;
                let timeseriesLength: number | undefined;
                if (timeseriesData?.[0]?.data !== undefined) {
                  maxValue = maxBy(timeseriesData[0].data, ({value}) => value);
                  timeseriesLength = timeseriesData[0].data.length;
                  if (hasFeature && timeseriesLength > 600) {
                    const avgData: SeriesDataUnit[] = [];
                    const minData: SeriesDataUnit[] = [];
                    const maxData: SeriesDataUnit[] = [];
                    const chunkSize = getBucketSize(
                      timeWindow,
                      timeseriesData[0].data.length
                    );
                    chunk(timeseriesData[0].data, chunkSize).forEach(seriesChunk => {
                      avgData.push({
                        name: seriesChunk[0].name,
                        value: AGGREGATE_FUNCTIONS.avg(seriesChunk),
                      });
                      minData.push({
                        name: seriesChunk[0].name,
                        value: AGGREGATE_FUNCTIONS.min(seriesChunk),
                      });
                      maxData.push({
                        name: seriesChunk[0].name,
                        value: AGGREGATE_FUNCTIONS.max(seriesChunk),
                      });
                    });
                    timeseriesData = [
                      timeseriesData[0],
                      {seriesName: t('Minimum'), data: minData},
                      {seriesName: t('Average'), data: avgData},
                      {seriesName: t('Maximum'), data: maxData},
                    ];
                  }
                }

                const chart = (
                  <React.Fragment>
                    <ControlsContainer>
                      <PeriodSelectControl
                        inline={false}
                        styles={{
                          control: provided => ({
                            ...provided,
                            minHeight: '25px',
                            height: '25px',
                          }),
                        }}
                        isSearchable={false}
                        isClearable={false}
                        disabled={loading || reloading}
                        name="statsPeriod"
                        value={period}
                        choices={statsPeriodOptions.map(timePeriod => [
                          timePeriod,
                          TIME_PERIOD_MAP[timePeriod],
                        ])}
                        onChange={this.handleStatsPeriodChange}
                      />
                    </ControlsContainer>

                    {loading || reloading ? (
                      <ChartPlaceholder />
                    ) : (
                      <React.Fragment>
                        <TransparentLoadingMask visible={reloading} />
                        <ThresholdsChart
                          period={statsPeriod}
                          maxValue={maxValue ? maxValue.value : maxValue}
                          data={timeseriesData}
                          triggers={triggers}
                          resolveThreshold={resolveThreshold}
                          thresholdType={thresholdType}
                        />
                      </React.Fragment>
                    )}
                  </React.Fragment>
                );

                return (
                  <Feature
                    organization={organization}
                    features={['metric-alert-gui-filters']}
                  >
                    {({hasFeature: hasGuiFilters}) =>
                      hasGuiFilters ? (
                        <ChartWrapper>{chart}</ChartWrapper>
                      ) : (
                        <StickyWrapper>
                          <StyledPanel>
                            <PanelBody withPadding>{chart}</PanelBody>
                          </StyledPanel>
                        </StickyWrapper>
                      )
                    }
                  </Feature>
                );
              }}
            </EventsRequest>
          );
        }}
      </Feature>
    );
  }
}

export default withApi(TriggersChart);

const TransparentLoadingMask = styled(LoadingMask)<{visible: boolean}>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

const ChartPlaceholder = styled(Placeholder)`
  /* Height and margin should add up to graph size (200px) */
  margin: 0 0 ${space(2)};
  height: 184px;
`;

const StickyWrapper = styled('div')`
  position: sticky;
  top: ${space(1)};
  z-index: ${p => p.theme.zIndex.dropdown - 1};
`;

const StyledPanel = styled(Panel)`
  /* Remove margin for the sticky window */
  margin-bottom: 0;
`;

const ControlsContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(1)};
`;

const PeriodSelectControl = styled(SelectControl)`
  display: inline-block;
  width: 180px;
  font-weight: normal;
  text-transform: none;
  border: 0;
`;

const ChartWrapper = styled('div')`
  padding: ${space(2)};
`;
