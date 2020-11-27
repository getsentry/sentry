import React from 'react';
import styled from '@emotion/styled';
import chunk from 'lodash/chunk';
import maxBy from 'lodash/maxBy';

import {fetchTotalCount} from 'app/actionCreators/events';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import EventsRequest from 'app/components/charts/eventsRequest';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import SelectControl from 'app/components/forms/selectControl';
import LoadingMask from 'app/components/loadingMask';
import {Panel, PanelBody} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {SeriesDataUnit} from 'app/types/echarts';
import withApi from 'app/utils/withApi';

import {IncidentRule, TimePeriod, TimeWindow, Trigger} from '../../types';

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
  totalEvents: number | null;
};

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends React.PureComponent<Props, State> {
  state: State = {
    statsPeriod: TimePeriod.ONE_DAY,
    totalEvents: null,
  };

  componentDidMount() {
    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {query, environment, timeWindow} = this.props;
    const {statsPeriod} = this.state;
    if (
      prevProps.environment !== environment ||
      prevProps.query !== query ||
      prevProps.timeWindow !== timeWindow ||
      prevState.statsPeriod !== statsPeriod
    ) {
      this.fetchTotalCount();
    }
  }

  handleStatsPeriodChange = (statsPeriod: {value: TimePeriod; label: string}) => {
    this.setState({statsPeriod: statsPeriod.value});
  };

  getStatsPeriod = () => {
    const {statsPeriod} = this.state;
    const {timeWindow} = this.props;
    const statsPeriodOptions = AVAILABLE_TIME_PERIODS[timeWindow];
    const period = statsPeriodOptions.includes(statsPeriod)
      ? statsPeriod
      : statsPeriodOptions[0];
    return period;
  };

  async fetchTotalCount() {
    const {api, organization, environment, projects, query} = this.props;
    const statsPeriod = this.getStatsPeriod();
    try {
      const totalEvents = await fetchTotalCount(api, organization.slug, {
        field: [],
        project: projects.map(({id}) => id),
        query,
        statsPeriod,
        environment: environment ? [environment] : [],
      });
      this.setState({totalEvents});
    } catch (e) {
      this.setState({totalEvents: null});
    }
  }

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
    const {statsPeriod, totalEvents} = this.state;

    const statsPeriodOptions = AVAILABLE_TIME_PERIODS[timeWindow];
    const period = this.getStatsPeriod();

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
                    <ChartControls>
                      <InlineContainer>
                        <SectionHeading>{t('Total Events')}</SectionHeading>
                        {totalEvents !== null ? (
                          <SectionValue>{totalEvents.toLocaleString()}</SectionValue>
                        ) : (
                          <SectionValue>&mdash;</SectionValue>
                        )}
                      </InlineContainer>
                      <InlineContainer>
                        <SectionHeading>{t('Display')}</SectionHeading>
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
                      </InlineContainer>
                    </ChartControls>
                  </React.Fragment>
                );

                return (
                  <Feature
                    organization={organization}
                    features={['metric-alert-gui-filters']}
                  >
                    {({hasFeature: hasGuiFilters}) =>
                      hasGuiFilters ? (
                        <React.Fragment>{chart}</React.Fragment>
                      ) : (
                        <StickyWrapper>
                          <StyledPanel>
                            <StyledPanelBody>{chart}</StyledPanelBody>
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

const StyledPanelBody = styled(PanelBody)`
  h4 {
    margin-bottom: ${space(1)};
  }
  padding-top: ${space(2)};
`;

const PeriodSelectControl = styled(SelectControl)`
  display: inline-block;
  width: 180px;
  font-weight: normal;
  text-transform: none;
  border: 0;
`;
