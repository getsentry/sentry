import {useState} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import type {APIRequestMethod} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {type FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

import {HTTPSnippet} from './httpSnippet';
import {UptimeHeadersField} from './uptimeHeadersField';

interface Props {
  apiMethod: APIRequestMethod;
  apiUrl: string;
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  project: Project;
  handleDelete?: () => void;
  rule?: UptimeRule;
}

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

function getFormDataFromRule(rule: UptimeRule) {
  return {
    name: rule.name,
    url: rule.url,
    projectSlug: rule.projectSlug,
    method: rule.method,
    body: rule.body,
    headers: rule.headers,
    owner: rule.owner ? `${rule.owner.type}:${rule.owner.id}` : null,
  };
}

export function UptimeAlertForm({
  apiMethod,
  apiUrl,
  project,
  onSubmitSuccess,
  handleDelete,
  rule,
}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const enabledConfiguration = organization.features.includes('uptime-api-create-update');
  const initialData = rule
    ? getFormDataFromRule(rule)
    : {projectSlug: project.slug, method: 'GET', headers: []};

  const submitLabel = {
    POST: t('Create Rule'),
    PUT: t('Save Rule'),
  };

  const [formModel] = useState(() => new FormModel());

  return (
    <Form
      model={formModel}
      apiMethod={apiMethod}
      apiEndpoint={apiUrl}
      saveOnBlur={false}
      initialData={initialData}
      onSubmitSuccess={onSubmitSuccess}
      submitLabel={submitLabel[apiMethod]}
      extraButton={
        rule && handleDelete ? (
          <Confirm
            message={t(
              'Are you sure you want to delete "%s"? Once deleted, this alert cannot be recreated automatically.',
              rule.name
            )}
            header={<h5>{t('Delete Uptime Rule?')}</h5>}
            priority="danger"
            confirmText={t('Delete Rule')}
            onConfirm={handleDelete}
          >
            <Button priority="danger">{t('Delete Rule')}</Button>
          </Confirm>
        ) : undefined
      }
    >
      <List symbol="colored-numeric">
        <AlertListItem>{t('Select a project')}</AlertListItem>
        <FormRow>
          <SentryProjectSelectorField
            disabled={rule !== undefined || !enabledConfiguration}
            disabledReason={t('Existing uptime rules cannot be moved between projects')}
            name="projectSlug"
            label={t('Project')}
            placeholder={t('Choose Project')}
            hideLabel
            projects={projects}
            valueIsSlug
            inline={false}
            flexibleControlStateSize
            stacked
          />
        </FormRow>
        <AlertListItem>{t('Configure Request')}</AlertListItem>
        <ConfigurationPanel>
          <TextField
            disabled={!enabledConfiguration}
            name="url"
            label={t('URL')}
            placeholder={t('The URL to monitor')}
            flexibleControlStateSize
            monospace
          />
          <SelectField
            disabled={!enabledConfiguration}
            name="method"
            label={t('Method')}
            placeholder={'GET'}
            options={HTTP_METHOD_OPTIONS.map(option => ({
              value: option,
              label: option,
            }))}
            flexibleControlStateSize
          />
          <UptimeHeadersField
            name="headers"
            label={t('Headers')}
            flexibleControlStateSize
            disabled={!enabledConfiguration}
          />
          <TextareaField
            name="body"
            label={t('Body')}
            visible={({model}) => !['GET', 'HEAD'].includes(model.getValue('method'))}
            rows={4}
            maxRows={15}
            autosize
            monospace
            placeholder='{"key": "value"}'
            flexibleControlStateSize
            disabled={!enabledConfiguration}
          />
        </ConfigurationPanel>
        <Observer>
          {() => (
            <HTTPSnippet
              url={formModel.getValue('url')}
              method={formModel.getValue('method')}
              headers={formModel.getValue('headers')}
              body={formModel.getValue('body')}
            />
          )}
        </Observer>
        <AlertListItem>{t('Establish ownership')}</AlertListItem>
        <FormRow>
          <TextField
            name="name"
            label={t('Uptime rule name')}
            hideLabel
            placeholder={t('Uptime rule name')}
            inline={false}
            flexibleControlStateSize
            stacked
          />
          <SentryMemberTeamSelectorField
            name="owner"
            label={t('Owner')}
            hideLabel
            menuPlacement="auto"
            inline={false}
            flexibleControlStateSize
            stacked
            style={{
              padding: 0,
              border: 'none',
            }}
          />
        </FormRow>
      </List>
    </Form>
  );
}

const AlertListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const FormRow = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  align-items: center;
  gap: ${space(2)};

  ${FieldWrapper} {
    padding: 0;
  }
`;

const ConfigurationPanel = styled(Panel)`
  display: grid;
  gap: 0 ${space(2)};
  grid-template-columns: max-content 1fr;
  align-items: center;

  ${FieldWrapper} {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
  }
`;
