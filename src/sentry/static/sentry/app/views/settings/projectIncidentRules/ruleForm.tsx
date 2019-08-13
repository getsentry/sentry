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
  isInverted: boolean;
  alertThreshold: number | null;
  resolveThreshold: number | null;
};

type AlertRuleThresholdKey = {
  [AlertRuleThreshold.INCIDENT]: 'alertThreshold';
  [AlertRuleThreshold.RESOLUTION]: 'resolveThreshold';
};

class RuleForm extends React.Component<Props, State> {
  static contextTypes = {
    form: PropTypes.any,
  };

  static defaultProps = {
    data: [],
  };

  state = {
    isInverted: this.props.initialData
      ? this.props.initialData.thresholdType === AlertRuleThresholdType.BELOW
      : false,
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

  /**
   * Changes the threshold type (i.e. if thresholds are inverted or not)
   */
  handleChangeThresholdType = (value: boolean) => {
    this.setState({isInverted: value});
    // We also need to reset resolution threshold, otherwise can be in an invalid state
    this.setState({resolveThreshold: null});
    this.context.form.setValue('resolveThreshold', null);
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
          interval="10m"
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
                  label: t('Metric'),
                  name: 'aggregations',
                  type: 'select',
                  help: t('Choose which metric to display on the Y-axis'),
                  choices: [
                    [AlertRuleAggregations.UNIQUE_USERS, 'Users Affected'],
                    [AlertRuleAggregations.TOTAL, 'Events'],
                  ],
                  required: true,
                  setValue: value => (value && value.length ? value[0] : value),
                  getValue: value => [value],
                },
                {
                  label: t('Time Window'),
                  name: 'timeWindow',
                  type: 'number',
                  min: 1,
                  max: 86400,
                  placeholder: '60',
                  help: t(
                    'The time window to use when evaluating the Metric (in number of seconds)'
                  ),
                  required: true,
                },
                {
                  label: t('Filter'),
                  name: 'query',
                  defaultValue: '',
                  type: 'text',
                  placeholder: 'error.type:TypeError',
                  help: t(
                    'You can apply standard Sentry filter syntax to filter by status, user, etc.'
                  ),
                },
                {
                  label: t('Incident Boundary'),
                  name: 'alertThreshold',
                  type: 'range',
                  help: !isInverted
                    ? t('Anything trending above this limit will trigger an Incident')
                    : t('Anything trending below this limit will trigger an Incident'),
                  onChange: this.handleChangeIncidentThresholdInput,
                  showCustomInput: true,
                  required: true,
                },
                {
                  label: t('Resolution Threshold'),
                  name: 'resolveThreshold',
                  type: 'range',
                  help: !isInverted
                    ? t('Anything trending below this limit will resolve an Incident')
                    : t('Anything trending above this limit will resolve an Incident'),
                  onChange: this.handleChangeResolutionThresholdInput,
                  showCustomInput: true,
                  placeholder: resolveThreshold === null ? t('Off') : '',
                  ...(!isInverted && alertThreshold !== null && {max: alertThreshold}),
                  ...(isInverted && alertThreshold !== null && {min: alertThreshold}),
                },
                {
                  label: t('Use an inverted incident threshold'),
                  name: 'thresholdType',
                  type: 'boolean',
                  defaultValue: AlertRuleThresholdType.ABOVE,
                  help: t(
                    'Alert me when the limit is trending below the incident boundary'
                  ),
                  onChange: this.handleChangeThresholdType,
                },
                {
                  label: t('Name'),
                  name: 'name',
                  type: 'text',
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
        thresholdType: AlertRuleThresholdType.ABOVE,
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
