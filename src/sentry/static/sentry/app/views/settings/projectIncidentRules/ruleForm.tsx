import {debounce} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {EventsStatsData, Organization, Project} from 'app/types';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

import IncidentRulesChart from './chart';
import {AlertRuleAggregations, AlertRuleThresholdType} from './constants';

type Props = {
  api: any;
  data: EventsStatsData;
  organization: Organization;
  project: Project;
};

type State = {
  width?: number;
  upperBound: number;
};

const START_POSITION = 20;

class RuleForm extends React.Component<Props, State> {
  static contextTypes = {
    form: PropTypes.any,
  };

  static defaultProps = {
    data: [],
  };

  state = {
    upperBound: START_POSITION,
  };

  handleChangeUpperBoundInput = debounce(upperBound => {
    this.setState({upperBound});
  }, 50);

  handleChangeUpperBound = upperBound => {
    this.setState({upperBound});
    this.context.form.setValue('alertThreshold', Math.round(upperBound));
  };
  render() {
    const {api, organization, project} = this.props;

    return (
      <React.Fragment>
        <EventsRequest
          api={api}
          organization={organization}
          project={[parseInt(project.id, 10)]}
          interval="10m"
          includePrevious={false}
        >
          {({timeseriesData}) => (
            <IncidentRulesChart
              onChangeUpperBound={this.handleChangeUpperBound}
              upperBound={this.state.upperBound}
              data={timeseriesData}
            />
          )}
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
                  help: t('Anything trending above this limit will trigger an Incident'),
                  onChange: this.handleChangeUpperBoundInput,
                  showCustomInput: true,
                  required: true,
                },
                {
                  label: t('Resolution Boundary'),
                  name: 'resolveThreshold',
                  type: 'range',
                  help: t('Anything trending below this limit will resolve an Incident'),
                  showCustomInput: true,
                  required: true,
                },
                {
                  label: t('Use an inverted incident threshold'),
                  name: 'thresholdType',
                  type: 'boolean',
                  defaultValue: AlertRuleThresholdType.ABOVE,
                  help: t(
                    'Alert me when the limit is trending below the incident boundary'
                  ),
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
  initialData?: {[key: string]: string | number | boolean};
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
      <RuleForm api={api} project={project} organization={organization} {...props} />
    </Form>
  );
}

export default withApi(withOrganization(withProject(RuleFormContainer)));
