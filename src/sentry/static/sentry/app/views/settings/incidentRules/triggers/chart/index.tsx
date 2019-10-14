import {maxBy} from 'lodash';
import React from 'react';
import moment from 'moment-timezone';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {Config, Organization, Project} from 'app/types';
import {SeriesDataUnit} from 'app/types/echarts';
import {getFormattedDate} from 'app/utils/dates';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import LoadingMask from 'app/components/loadingMask';
import Placeholder from 'app/components/placeholder';
import SelectControl from 'app/components/forms/selectControl';

import {
  AlertRuleAggregations,
  IncidentRule,
  TimeWindow,
  ProjectSelectOption,
} from '../../types';
import DraggableChart from './draggableChart';

type Props = {
  api: Client;
  config: Config;
  organization: Organization;
  projects: Project[];
  rule: IncidentRule;
  isInverted: boolean;
  timeWindow: number;
  alertThreshold: number | null;
  resolveThreshold: number | null;
  onChangeIncidentThreshold: (alertThreshold: number) => void;
  onChangeResolutionThreshold: (resolveThreshold: number) => void;
};

type State = {
  // This is an array but we are only supporting a single project for now
  selectedProjects: ProjectSelectOption[];
};

class TriggersChart extends React.Component<Props, State> {
  state = {
    selectedProjects: [],
  };

  handleSelectProjects = (selectedProjects: ProjectSelectOption) => {
    this.setState({
      selectedProjects: [selectedProjects],
    });
  };

  render() {
    const {
      api,
      config,
      organization,
      projects,
      alertThreshold,
      resolveThreshold,
      isInverted,
      rule,
    } = this.props;
    const {timeWindow} = rule;
    const {selectedProjects} = this.state;
    const projectOptions = projects.map(({id, slug}) => ({
      value: Number(id),
      label: slug,
    }));

    // Show a placeholder with a message to select a project (as well as project selector)

    if (selectedProjects.length === 0) {
      return (
        <SelectProjectPlaceholder height="200px" bottomGutter={1}>
          <SelectProjectWrapper>
            Select Project to see last 24 hours of data
            <SelectControl
              options={projectOptions}
              onChange={this.handleSelectProjects}
            />
          </SelectProjectWrapper>
        </SelectProjectPlaceholder>
      );
    }
    return (
      <EventsRequest
        api={api}
        organization={organization}
        project={selectedProjects.map(({value}) => value)}
        interval={`${timeWindow}s`}
        period={getPeriodForTimeWindow(timeWindow)}
        yAxis={
          rule.aggregations[0] === AlertRuleAggregations.TOTAL
            ? 'event_count'
            : 'user_count'
        }
        includePrevious={false}
      >
        {({loading, reloading, timeseriesData}) => {
          let maxValue: SeriesDataUnit | undefined;
          if (timeseriesData && timeseriesData.length && timeseriesData[0].data) {
            maxValue = maxBy(timeseriesData[0].data, ({value}) => value);
          }

          return (
            <React.Fragment>
              {loading ? (
                <Placeholder height="200px" bottomGutter={1} />
              ) : (
                <React.Fragment>
                  <TransparentLoadingMask visible={reloading} />
                  <DraggableChart
                    xAxis={{
                      axisLabel: {
                        formatter: (value: moment.MomentInput, index: number) => {
                          const firstItem = index === 0;
                          const format =
                            timeWindow <= TimeWindow.FIVE_MINUTES && !firstItem
                              ? 'LT'
                              : 'MMM Do';
                          return getFormattedDate(value, format, {
                            local: config.user.options.timezone !== 'UTC',
                          });
                        },
                      },
                    }}
                    maxValue={maxValue ? maxValue.value : maxValue}
                    onChangeIncidentThreshold={this.props.onChangeIncidentThreshold}
                    alertThreshold={alertThreshold}
                    onChangeResolutionThreshold={this.props.onChangeResolutionThreshold}
                    resolveThreshold={resolveThreshold}
                    isInverted={isInverted}
                    data={timeseriesData}
                    projectOptions={projectOptions}
                    selectedProjects={selectedProjects}
                    onChangeProjects={this.handleSelectProjects}
                  />
                </React.Fragment>
              )}
            </React.Fragment>
          );
        }}
      </EventsRequest>
    );
  }
}

export default TriggersChart;

type TimeWindowMapType = {[key in TimeWindow]: string};

const TIME_WINDOW_TO_PERIOD: TimeWindowMapType = {
  [TimeWindow.ONE_MINUTE]: '12h',
  [TimeWindow.FIVE_MINUTES]: '12h',
  [TimeWindow.TEN_MINUTES]: '1d',
  [TimeWindow.FIFTEEN_MINUTES]: '3d',
  [TimeWindow.THIRTY_MINUTES]: '3d',
  [TimeWindow.ONE_HOUR]: '7d',
  [TimeWindow.TWO_HOURS]: '7d',
  [TimeWindow.FOUR_HOURS]: '7d',
  [TimeWindow.ONE_DAY]: '14d',
};

/**
 * Gets a reasonable period given a timewindow (in seconds)
 *
 * @param timeWindow The time window in seconds
 * @return period The period string to use (e.g. 14d)
 */
function getPeriodForTimeWindow(timeWindow: TimeWindow): string {
  return TIME_WINDOW_TO_PERIOD[timeWindow];
}

const TransparentLoadingMask = styled(LoadingMask)<{visible: boolean}>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

const SelectProjectPlaceholder = styled(Placeholder)`
  background-color: white;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  align-items: center;
`;

const SelectProjectWrapper = styled('div')`
  width: 40%;
`;
