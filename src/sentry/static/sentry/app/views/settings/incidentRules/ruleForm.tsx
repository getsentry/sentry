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

import {AlertRuleAggregations, IncidentRule} from './constants';

const DEFAULT_METRIC = [AlertRuleAggregations.TOTAL];

type Props = {
  api: Client;
  organization: Organization;
  initialData?: IncidentRule;
  projects: Project[];
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
                name: 'includeAllProjects',
                type: 'boolean',
                label: t('Apply to all Projects'),
                help: t(
                  'This should apply to all projects as well as all future projects'
                ),
              },
              {
                name: 'projects',
                type: 'select',
                label: t('Projects'),
                help: t('Select projects that this rule will apply to'),
                choices: projects.map(({slug}) => [slug, slug]),
                placeholder: t('All Projects'),
                multiple: true,
                required: true,
                visible: ({model}) => !model.getValue('includeAllProjects'),
              },
              {
                name: 'excludedProjects',
                type: 'select',
                label: t('Exclude Projects'),
                help: t('Select projects that will be excluded from this rule'),
                choices: projects.map(({slug}) => [slug, slug]),
                placeholder: t('None'),
                multiple: true,
                visible: ({model}) => !!model.getValue('includeAllProjects'),
              },
              {
                name: 'aggregations',
                type: 'select',
                label: t('Metric'),
                help: t('Choose which metric to trigger on'),
                choices: [
                  [AlertRuleAggregations.UNIQUE_USERS, 'Users Affected'],
                  [AlertRuleAggregations.TOTAL, 'Events'],
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
                name: 'isDefault',
                type: 'boolean',
                label: t('Is Default'),
                defaultValue: false,
                help: t('Default rules will visible for all members of an organization?'),
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
  onSubmitSuccess?: Function;
} & React.ComponentProps<typeof RuleForm>;

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
