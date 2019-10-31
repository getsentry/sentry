import React from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SearchBar from 'app/views/events/searchBar';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {AlertRuleAggregations, IncidentRule, TimeWindow} from './types';
import getMetricDisplayName from './utils/getMetricDisplayName';

const DEFAULT_METRIC = [AlertRuleAggregations.TOTAL];

type Props = {
  api: Client;
  organization: Organization;
  initialData?: IncidentRule;
  projects: Project[];
};

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

class RuleForm extends React.Component<Props> {
  render() {
    const {organization, projects} = this.props;

    return (
      <JsonForm
        forms={[
          {
            title: t('Metric'),
            fields: [
              {
                name: 'name',
                type: 'text',
                label: t('Name'),
                help: t('Give your Incident Rule a name so it is easy to manage later'),
                placeholder: t('My Incident Rule Name'),
                required: true,
              },
              {
                name: 'projects',
                type: 'select',
                label: t('Project'),
                help: t('Select a project that this rule will apply to'),
                choices: projects.map(({slug}) => [slug, slug]),
                getValue: value => [value],
                setValue: value => (value.length ? value[0] : []),
                placeholder: t('Select a project'),
                required: true,
              },
              {
                name: 'aggregations',
                type: 'select',
                label: t('Metric'),
                help: t('Choose which metric to trigger on'),
                choices: [
                  [
                    AlertRuleAggregations.UNIQUE_USERS,
                    getMetricDisplayName(AlertRuleAggregations.UNIQUE_USERS),
                  ],
                  [
                    AlertRuleAggregations.TOTAL,
                    getMetricDisplayName(AlertRuleAggregations.TOTAL),
                  ],
                ],
                required: true,
                setValue: value => (value && value.length ? value[0] : value),
                getValue: value => [value],
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
                name: 'timeWindow',
                type: 'select',
                label: t('Time Window'),
                help: t('The time window to use when evaluating the Metric'),
                choices: Object.entries(TIME_WINDOW_MAP),
                required: true,
              },
            ],
          },
        ]}
      />
    );
  }
}

type RuleFormContainerProps = {
  initialData?: IncidentRule;
  orgId: string;
  incidentRuleId?: string;
  saveOnBlur?: boolean;
} & React.ComponentProps<typeof RuleForm> & {
    onSubmitSuccess?: Form['props']['onSubmitSuccess'];
  };

function RuleFormContainer({
  orgId,
  incidentRuleId,
  initialData,
  saveOnBlur,
  onSubmitSuccess,
  ...props
}: RuleFormContainerProps) {
  return (
    <Form
      apiMethod={incidentRuleId ? 'PUT' : 'POST'}
      apiEndpoint={`/organizations/${orgId}/alert-rules/${
        incidentRuleId ? `${incidentRuleId}/` : ''
      }`}
      initialData={{
        query: '',
        aggregations: DEFAULT_METRIC,
        projects: [],
        includeAllProjects: false,
        excludedProjects: [],

        // TODO(incidents): Temp values
        alertThreshold: 5,
        project_id: 1,
        resolveThreshold: 1,
        thresholdType: 0,
        timeWindow: 60,
        ...initialData,
      }}
      saveOnBlur={saveOnBlur}
      onSubmitSuccess={onSubmitSuccess}
    >
      <RuleForm initialData={initialData} {...props} />
    </Form>
  );
}

export {RuleFormContainer};
export default withProjects(withApi(withOrganization(RuleFormContainer)));
