import {debounce} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {Config, EventsStatsData, Organization, Project} from 'app/types';
import {PanelAlert} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {getFormattedDate} from 'app/utils/dates';
import {t} from 'app/locale';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import LoadingMask from 'app/components/loadingMask';
import Placeholder from 'app/components/placeholder';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import SearchBar from 'app/views/events/searchBar';

import {
  AlertRuleAggregations,
  AlertRuleThreshold,
  AlertRuleThresholdType,
} from './constants';
import {IncidentRule} from './types';
import IncidentRulesChart from './chart';

type Props = {
  api: Client;
  config: Config;
  data: EventsStatsData;
  organization: Organization;
  project: Project;
  initialData?: IncidentRule;
};

type State = {
  width?: number;
  aggregations: AlertRuleAggregations[];
  isInverted: boolean;
  timeWindow: number;
  alertThreshold: number | null;
  resolveThreshold: number | null;
};

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

const TIME_WINDOW_MAP: TimeWindowMapType = {
  [TimeWindow.ONE_MINUTE]: t('1 minute'),
  [TimeWindow.FIVE_MINUTES]: t('5 minutes'),
  [TimeWindow.TEN_MINUTES]: t('10 minutes'),
  [TimeWindow.FIFTEEN_MINUTES]: t('15 minutes'),
  [TimeWindow.THIRTY_MINUTES]: t('30 minutes'),
  [TimeWindow.ONE_HOUR]: t('1 hour'),
  [TimeWindow.TWO_HOURS]: t('2 hours'),
  [TimeWindow.FOUR_HOURS]: t('4 hours'),
  [TimeWindow.ONE_DAY]: t('24 hours'),
};

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

class RuleForm extends React.Component<Props, State> {
  static contextTypes = {
    form: PropTypes.any,
  };

  static defaultProps = {
    data: [],
  };

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

  updateThresholdInput = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      this.setState(state => ({
        ...state,
        [this.getThresholdKey(type)]: value,
      }));
    } else {
      this.revertThresholdUpdate(type);
    }
  };

  updateThreshold = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      const thresholdKey = this.getThresholdKey(type);
      const newValue = Math.round(value);
      this.setState(state => ({
        ...state,
        [thresholdKey]: newValue,
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
    const {api, config, organization, project} = this.props;
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
          project={[parseInt(project.id, 10)]}
          interval={`${timeWindow}s`}
          period={this.getPeriodForTimeWindow(timeWindow)}
          yAxis={
            aggregations[0] === AlertRuleAggregations.TOTAL ? 'event_count' : 'user_count'
          }
          includePrevious={false}
        >
          {({loading, reloading, timeseriesData}) =>
            loading ? (
              <Placeholder height="200px" bottomGutter={1} />
            ) : (
              <React.Fragment>
                <TransparentLoadingMask visible={reloading} />
                <IncidentRulesChart
                  xAxis={{
                    axisLabel: {
                      formatter: (value, index) => {
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
                  onChangeIncidentThreshold={this.handleChangeIncidentThreshold}
                  alertThreshold={alertThreshold}
                  onChangeResolutionThreshold={this.handleChangeResolutionThreshold}
                  resolveThreshold={resolveThreshold}
                  isInverted={isInverted}
                  data={timeseriesData}
                />
              </React.Fragment>
            )
          }
        </EventsRequest>
        <JsonForm
          renderHeader={() => {
            return (
              <PanelAlert type="info">
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
                  name: 'aggregations',
                  type: 'select',
                  label: t('Metric'),
                  help: t('Choose which metric to display on the Y-axis'),
                  choices: [
                    [AlertRuleAggregations.UNIQUE_USERS, 'Users Affected'],
                    [AlertRuleAggregations.TOTAL, 'Events'],
                  ],
                  required: true,
                  setValue: value => (value && value.length ? value[0] : value),
                  getValue: value => [value],
                  onChange: this.handleChangeMetric,
                },
                {
                  name: 'query',
                  type: 'custom',
                  label: t('Filter'),
                  defaultValue: '',
                  placeholder: 'error.type:TypeError',
                  help: t(
                    'You can apply standard Sentry filter syntax to filter by status, user, etc.'
                  ),
                  Component: props => {
                    return (
                      <FormField {...props}>
                        {({onChange, onBlur, onKeyDown}) => {
                          return (
                            <SearchBar
                              useFormWrapper={false}
                              organization={organization}
                              onChange={onChange}
                              onBlur={onBlur}
                              onKeyDown={onKeyDown}
                              onSearch={query => onChange(query, {})}
                            />
                          );
                        }}
                      </FormField>
                    );
                  },
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
                  ...(!isInverted &&
                    alertThreshold !== null && {min: 1, max: alertThreshold}),
                  ...(isInverted &&
                    alertThreshold !== null && {min: alertThreshold || 1}),
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
                {
                  name: 'timeWindow',
                  type: 'select',
                  label: t('Time Window'),
                  help: t('The time window to use when evaluating the Metric'),
                  onChange: this.handleTimeWindowChange,
                  choices: Object.entries(TIME_WINDOW_MAP),
                  required: true,
                },
                {
                  name: 'name',
                  type: 'text',
                  label: t('Name'),
                  help: t('Give your Incident Rule a name so it is easy to manage later'),
                  placeholder: t('My Incident Rule Name'),
                  required: true,
                },
              ],
            },
          ]}
        />
      </React.Fragment>
    );
  }
}

type RuleFormContainerProps = {
  api: Client;
  config: Config;
  organization: Organization;
  project: Project;
  orgId: string;
  projectId: string;
  incidentRuleId?: string;
  initialData?: IncidentRule;
  onSubmitSuccess?: Function;
};
function RuleFormContainer({
  api,
  organization,
  project,
  orgId,
  projectId,
  incidentRuleId,
  initialData,
  onSubmitSuccess,
  ...props
}: RuleFormContainerProps) {
  return (
    <Form
      apiMethod={incidentRuleId ? 'PUT' : 'POST'}
      apiEndpoint={`/projects/${orgId}/${projectId}/alert-rules/${
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
      <RuleForm
        api={api}
        project={project}
        organization={organization}
        initialData={initialData}
        {...props}
      />
    </Form>
  );
}

const TransparentLoadingMask = styled(LoadingMask)<{visible: boolean}>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

export default withConfig(withApi(withOrganization(withProject(RuleFormContainer))));
