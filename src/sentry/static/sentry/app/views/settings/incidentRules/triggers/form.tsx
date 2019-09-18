import {debounce, maxBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment-timezone';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {Config, Organization, Project} from 'app/types';
import {PanelAlert} from 'app/components/panels';
import {SeriesDataUnit} from 'app/types/echarts';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {getFormattedDate} from 'app/utils/dates';
import {t} from 'app/locale';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import LoadingMask from 'app/components/loadingMask';
import Placeholder from 'app/components/placeholder';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';

import {
  AlertRuleAggregations,
  AlertRuleThreshold,
  AlertRuleThresholdType,
} from '../constants';
import {IncidentRule} from '../types';
import IncidentRulesChart from '../chart';

type AlertRuleThresholdKey = {
  [AlertRuleThreshold.INCIDENT]: 'alertThreshold';
  [AlertRuleThreshold.RESOLUTION]: 'resolveThreshold';
};

enum TimeWindow {
  ONE_MINUTE = 60,
  FIVE_MINUTES = 300,
  TEN_MINUTES = 600,
  FIFTEEN_MINUTES = 900,
  THIRTY_MINUTES = 1800,
  ONE_HOUR = 3600,
  TWO_HOURS = 7200,
  FOUR_HOURS = 14400,
  ONE_DAY = 86400,
}

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

const DEFAULT_TIME_WINDOW = 60;
const DEFAULT_METRIC = [AlertRuleAggregations.TOTAL];

type Props = {
  api: Client;
  config: Config;
  organization: Organization;
  project?: Project;
  projects?: Project[];
  initialData?: IncidentRule;
};

type State = {
  width?: number;
  aggregations: AlertRuleAggregations[];
  isInverted: boolean;
  timeWindow: number;
  alertThreshold: number | null;
  resolveThreshold: number | null;
  maxThreshold: number | null;
};

class TriggerForm extends React.Component<Props, State> {
  static contextTypes = {
    form: PropTypes.any,
  };

  static defaultProps = {};

  state = {
    aggregations: this.props.initialData
      ? this.props.initialData.aggregations
      : DEFAULT_METRIC,
    isInverted: this.props.initialData
      ? this.props.initialData.thresholdType === AlertRuleThresholdType.BELOW
      : false,
    timeWindow: this.props.initialData
      ? this.props.initialData.timeWindow
      : DEFAULT_TIME_WINDOW,
    alertThreshold: this.props.initialData ? this.props.initialData.alertThreshold : null,
    resolveThreshold: this.props.initialData
      ? this.props.initialData.resolveThreshold
      : null,
    maxThreshold: this.props.initialData
      ? Math.max(
          this.props.initialData.alertThreshold,
          this.props.initialData.resolveThreshold
        ) || null
      : null,
  };

  getThresholdKey = (
    type: AlertRuleThreshold
  ): AlertRuleThresholdKey[AlertRuleThreshold] =>
    type === AlertRuleThreshold.RESOLUTION ? 'resolveThreshold' : 'alertThreshold';

  /**
   * Gets a reasonable period given a timewindow (in seconds)
   *
   * @param timeWindow The time window in seconds
   * @return period The period string to use (e.g. 14d)
   */
  getPeriodForTimeWindow = (timeWindow: TimeWindow): string =>
    TIME_WINDOW_TO_PERIOD[timeWindow];

  /**
   * Checks to see if threshold is valid given target value, and state of
   * inverted threshold as well as the *other* threshold
   *
   * @param type The threshold type to be updated
   * @param value The new threshold value
   */
  canUpdateThreshold = (type: AlertRuleThreshold, value: number): boolean => {
    const isResolution = type === AlertRuleThreshold.RESOLUTION;
    const otherKey = isResolution ? 'alertThreshold' : 'resolveThreshold';
    const otherValue = this.state[otherKey];

    // If other value is `null`, then there are no checks to perform against
    if (otherValue === null) {
      return true;
    }

    // If this is alert threshold and not inverted, it can't be below resolve
    // If this is alert threshold and inverted, it can't be above resolve
    // If this is resolve threshold and not inverted, it can't be above resolve
    // If this is resolve threshold and inverted, it can't be below resolve
    return !!this.state.isInverted !== isResolution
      ? value <= otherValue
      : value >= otherValue;
  };

  /**
   * Happens if the target threshold value is in valid. We do not pre-validate because
   * it's difficult to do so with our charting library, so we validate after the
   * change propagates.
   *
   * Show an error message and reset form value, as well as force a re-rendering of chart
   * with old values (so the dragged line "resets")
   */
  revertThresholdUpdate = (type: AlertRuleThreshold) => {
    const isIncident = type === AlertRuleThreshold.INCIDENT;
    const typeDisplay = isIncident ? t('Incident boundary') : t('Resolution boundary');
    const otherTypeDisplay = !isIncident
      ? t('Incident boundary')
      : t('Resolution boundary');

    // if incident and not inverted: incident required to be >
    // if resolution and inverted: resolution required to be >
    const direction = isIncident !== this.state.isInverted ? 'greater' : 'less';

    addErrorMessage(t(`${typeDisplay} must be ${direction} than ${otherTypeDisplay}`));

    // Need to a re-render so that our chart re-renders and moves the draggable line back
    // to its original position (since the drag update is not valid)
    this.forceUpdate();

    // Reset form value
    const thresholdKey = this.getThresholdKey(type);
    this.context.form.setValue(thresholdKey, this.state[thresholdKey]);
  };

  /**
   * Handler for the range slider input. Needs to update state (as well as max threshold)
   */
  updateThresholdInput = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      this.setState(state => ({
        ...state,
        [this.getThresholdKey(type)]: value,
        ...(value > (state.maxThreshold || 0) && {maxThreshold: value}),
      }));
    } else {
      this.revertThresholdUpdate(type);
    }
  };

  /**
   * Handler for threshold changes coming from slider or chart.
   * Needs to sync state with the form.
   */
  updateThreshold = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      const thresholdKey = this.getThresholdKey(type);
      const newValue = Math.round(value);
      this.setState(state => ({
        ...state,
        [thresholdKey]: newValue,
        ...(newValue > (state.maxThreshold || 0) && {maxThreshold: newValue}),
      }));
      this.context.form.setValue(thresholdKey, Math.round(newValue));
    } else {
      this.revertThresholdUpdate(type);
    }
  };

  handleChangeIncidentThresholdInput = debounce((value: number) => {
    this.updateThresholdInput(AlertRuleThreshold.INCIDENT, value);
  }, 50);

  handleChangeIncidentThreshold = (value: number) => {
    this.updateThreshold(AlertRuleThreshold.INCIDENT, value);
  };

  handleChangeResolutionThresholdInput = debounce((value: number) => {
    this.updateThresholdInput(AlertRuleThreshold.RESOLUTION, value);
  }, 50);

  handleChangeResolutionThreshold = (value: number) => {
    this.updateThreshold(AlertRuleThreshold.RESOLUTION, value);
  };

  handleTimeWindowChange = (timeWindow: TimeWindow) => {
    this.setState({timeWindow});
  };

  handleChangeMetric = (aggregations: AlertRuleAggregations) => {
    this.setState({aggregations: [aggregations]});
  };

  /**
   * Changes the threshold type (i.e. if thresholds are inverted or not)
   */
  handleChangeThresholdType = (value: boolean) => {
    // Swap values and toggle `state.isInverted`, so they if invert it twice, they get their original values
    this.setState(state => {
      const oldValues = {
        resolve: state.resolveThreshold,
        alert: state.alertThreshold,
      };

      this.context.form.setValue('resolveThreshold', oldValues.alert);
      this.context.form.setValue('alertThreshold', oldValues.resolve);
      return {
        isInverted: value,
        resolveThreshold: oldValues.alert,
        alertThreshold: oldValues.resolve,
      };
    });
  };

  render() {
    const {api, config, organization, projects, project} = this.props;
    const {
      aggregations,
      alertThreshold,
      resolveThreshold,
      isInverted,
      timeWindow,
    } = this.state;

    return (
      <React.Fragment>
        <EventsRequest
          api={api}
          organization={organization}
          project={[(project && parseInt(project.id, 10)) || 1]}
          interval={`${timeWindow}s`}
          period={this.getPeriodForTimeWindow(timeWindow)}
          yAxis={
            aggregations[0] === AlertRuleAggregations.TOTAL ? 'event_count' : 'user_count'
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
                    <IncidentRulesChart
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
                      onChangeIncidentThreshold={this.handleChangeIncidentThreshold}
                      alertThreshold={alertThreshold}
                      onChangeResolutionThreshold={this.handleChangeResolutionThreshold}
                      resolveThreshold={resolveThreshold}
                      isInverted={isInverted}
                      data={timeseriesData}
                      projects={projects}
                    />
                  </React.Fragment>
                )}
              </React.Fragment>
            );
          }}
        </EventsRequest>

        <div>
          <JsonForm
            renderHeader={() => {
              return (
                <PanelAlert type="warning">
                  {t(
                    'Sentry will automatically digest alerts sent by some services to avoid flooding your inbox with individual issue notifications. Use the sliders to control frequency.'
                  )}
                </PanelAlert>
              );
            }}
            forms={[
              {
                title: t('Metric'),
                fields: [
                  {
                    name: 'name',
                    type: 'text',
                    label: t('Label'),
                    help: t('This will prefix alerts created by this trigger'),
                    placeholder: t('SEV-0'),
                    required: true,
                  },
                  {
                    name: 'alertThreshold',
                    type: 'range',
                    label: t('Incident Boundary'),
                    help: !isInverted
                      ? t('Anything trending above this limit will trigger an Incident')
                      : t('Anything trending below this limit will trigger an Incident'),
                    onChange: this.handleChangeIncidentThresholdInput,
                    showCustomInput: true,
                    required: true,
                    min: 1,
                  },
                  {
                    name: 'resolveThreshold',
                    type: 'range',
                    label: t('Resolution Boundary'),
                    help: !isInverted
                      ? t('Anything trending below this limit will resolve an Incident')
                      : t('Anything trending above this limit will resolve an Incident'),
                    onChange: this.handleChangeResolutionThresholdInput,
                    showCustomInput: true,
                    placeholder: resolveThreshold === null ? t('Off') : '',
                    min: 1,
                  },
                  {
                    name: 'thresholdType',
                    type: 'boolean',
                    label: t('Reverse the Boundaries'),
                    defaultValue: AlertRuleThresholdType.ABOVE,
                    help: t(
                      'This is a metric that needs to stay above a certain threshold'
                    ),
                    onChange: this.handleChangeThresholdType,
                  },
                ],
              },
            ]}
          />
        </div>
      </React.Fragment>
    );
  }
}

type TriggerFormContainerProps = {
  initialData?: IncidentRule;
  orgId: string;
  incidentRuleId?: string;
  onSubmitSuccess?: Function;
} & React.ComponentProps<typeof TriggerForm>;

function TriggerFormContainer({
  orgId,
  incidentRuleId,
  initialData,
  onSubmitSuccess,
  ...props
}: TriggerFormContainerProps) {
  return (
    <Form
      apiMethod={incidentRuleId ? 'PUT' : 'POST'}
      apiEndpoint={`/projects/${orgId}/alert-rules/${
        incidentRuleId ? `${incidentRuleId}/` : ''
      }`}
      initialData={{
        query: '',
        aggregations: DEFAULT_METRIC,
        thresholdType: AlertRuleThresholdType.ABOVE,
        timeWindow: DEFAULT_TIME_WINDOW,
        ...initialData,
      }}
      saveOnBlur={false}
      onSubmitSuccess={onSubmitSuccess}
    >
      <TriggerForm initialData={initialData} {...props} />
    </Form>
  );
}

const TransparentLoadingMask = styled(LoadingMask)<{visible: boolean}>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

export default withConfig(withApi(TriggerFormContainer));
