import React from 'react';
import maxBy from 'lodash/maxBy';
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
  ],
  [TimeWindow.FIVE_MINUTES]: [
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
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

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends React.PureComponent<Props> {
  state = {
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

    const period = AVAILABLE_TIME_PERIODS[timeWindow].includes(statsPeriod)
      ? statsPeriod
      : AVAILABLE_TIME_PERIODS[timeWindow][0];
    const statsPeriodOptions = AVAILABLE_TIME_PERIODS[timeWindow];

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
          if (timeseriesData && timeseriesData.length && timeseriesData[0].data) {
            maxValue = maxBy(timeseriesData[0].data, ({value}) => value);
          }

          return (
            <StickyWrapper>
              <StyledPanel>
                <PanelBody withPadding>
                  <Feature
                    features={['metric-alert-stats-period']}
                    organization={organization}
                  >
                    <StyledSelectField
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
                      required
                      flexibleControlStateSize
                      choices={statsPeriodOptions.map(timePeriod => [
                        timePeriod,
                        TIME_PERIOD_MAP[timePeriod],
                      ])}
                      onChange={this.handleStatsPeriodChange}
                    />
                  </Feature>

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
                </PanelBody>
                {/* <StyledPanelAlert>
                  {t('Data points above are averaged to show a longer time period.')}
                </StyledPanelAlert> */}
              </StyledPanel>
            </StickyWrapper>
          );
        }}
      </EventsRequest>
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
  top: 69px; /* Height of settings breadcrumb 69px */
  z-index: ${p => p.theme.zIndex.dropdown - 1};
  background: rgba(255, 255, 255, 0.9);
`;

const StyledPanel = styled(Panel)`
  /* Can't have marign with the sticky window */
  margin-bottom: 0;
  /* Keep semi transparent background */
  background: none;
`;

const StyledSelectField = styled(SelectControl)`
  width: 180px;
  margin: 0 0 ${space(1)} auto;
  font-weight: normal;
  text-transform: none;
  border: 0;
`;
