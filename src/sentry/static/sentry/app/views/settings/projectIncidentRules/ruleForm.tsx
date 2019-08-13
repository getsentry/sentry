import {debounce} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {EventsStatsData, Organization, Project} from 'app/types';
import {PanelAlert} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Placeholder from 'app/components/placeholder';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

import {
  AlertRuleAggregations,
  AlertRuleThreshold,
  AlertRuleThresholdType,
} from './constants';
import {IncidentRule} from './types';
import IncidentRulesChart from './chart';

type Props = {
  api: any;
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
   * Checks to see if threshold is valid given target value, and state of
   * inverted threshold as well as the *other* threshold
   *
   * @param type The threshold type to be updated
   * @param value The new threshold value
   */
  canUpdateThreshold = (type: AlertRuleThreshold, value: number): boolean => {
    const isResolution = type === AlertRuleThreshold.RESOLUTION;

    // If this is alert threshold and not inverted, it can't be below resolve
    // If this is alert threshold and inverted, it can't be above resolve
    // If this is resolve threshold and not inverted, it can't be above resolve
    // If this is resolve threshold and inverted, it can't be below resolve
    return !!this.state.isInverted !== isResolution
      ? value < (this.state[isResolution ? 'alertThreshold' : 'resolveThreshold'] || 0)
      : value > (this.state[isResolution ? 'alertThreshold' : 'resolveThreshold'] || 0);
  };

  revertThresholdUpdate = () => {
    addErrorMessage(t('Invalid threshold value'));
    // Need to a re-render so that our chart re-renders and moves the draggable line back
    // to its original position (since the drag update is not valid)
    this.forceUpdate();
  };

  updateThresholdInput = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      this.setState(state => ({
        ...state,
        [this.getThresholdKey(type)]: value,
      }));
    } else {
      this.revertThresholdUpdate();
    }
  };

  updateThreshold = (type: AlertRuleThreshold, value: number) => {
    if (this.canUpdateThreshold(type, value)) {
      const thresholdKey = this.getThresholdKey(type);
      this.setState(state => ({
        ...state,
        [thresholdKey]: value,
      }));
      this.context.form.setValue(thresholdKey, Math.round(value));
    } else {
      this.revertThresholdUpdate();
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

  handleTimeWindowChange = (timeWindow: number) => {
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
    const {api, organization, project} = this.props;
    const {alertThreshold, resolveThreshold, isInverted} = this.state;

    return (
      <React.Fragment>
        <EventsRequest
          api={api}
          organization={organization}
          project={[parseInt(project.id, 10)]}
          interval={`${this.state.timeWindow}s`}
          yAxis={
            this.state.aggregations[0] === AlertRuleAggregations.TOTAL
              ? 'event_count'
              : 'user_count'
          }
          includePrevious={false}
        >
          {({loading, timeseriesData}) =>
            loading ? (
              <Placeholder height="200px" bottomGutter={1} />
            ) : (
              <IncidentRulesChart
                onChangeIncidentThreshold={this.handleChangeIncidentThreshold}
                alertThreshold={alertThreshold}
                onChangeResolutionThreshold={this.handleChangeResolutionThreshold}
                resolveThreshold={resolveThreshold}
                isInverted={isInverted}
                data={timeseriesData}
              />
            )
          }
        </EventsRequest>
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
                  name: 'timeWindow',
                  type: 'select',
                  label: t('Time Window'),
                  help: t('The time window to use when evaluating the Metric'),
                  onChange: this.handleTimeWindowChange,
                  choices: [
                    [60, t('1 minute')],
                    [300, t('5 minutes')],
                    [600, t('10 minutes')],
                    [900, t('15 minutes')],
                    [1800, t('30 minutes')],
                    [3600, t('1 hour')],
                    [7200, t('2 hours')],
                    [14400, t('4 hours')],
                    [86400, t('24 hours')],
                  ],
                  required: true,
                },
                {
                  name: 'query',
                  type: 'text',
                  label: t('Filter'),
                  defaultValue: '',
                  placeholder: 'error.type:TypeError',
                  help: t(
                    'You can apply standard Sentry filter syntax to filter by status, user, etc.'
                  ),
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
                },
                {
                  name: 'resolveThreshold',
                  type: 'range',
                  label: t('Resolution Threshold'),
                  help: !isInverted
                    ? t('Anything trending below this limit will resolve an Incident')
                    : t('Anything trending above this limit will resolve an Incident'),
                  onChange: this.handleChangeResolutionThresholdInput,
                  showCustomInput: true,
                  placeholder: resolveThreshold === null ? t('Off') : '',
                  ...(resolveThreshold !== null &&
                    !isInverted &&
                    alertThreshold !== null && {max: alertThreshold}),
                  ...(resolveThreshold !== null &&
                    isInverted &&
                    alertThreshold !== null && {min: alertThreshold}),
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
  api: any;
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

export default withApi(withOrganization(withProject(RuleFormContainer)));
