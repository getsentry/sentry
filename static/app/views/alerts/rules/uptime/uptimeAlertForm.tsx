import styled from '@emotion/styled';

import type {APIRequestMethod} from 'sentry/api';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {type FormProps} from 'sentry/components/forms/form';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

interface Props {
  apiMethod: APIRequestMethod;
  apiUrl: string;
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  project: Project;
  handleDelete?: () => void;
  rule?: UptimeRule;
}

function getFormDataFromRule(rule: UptimeRule) {
  const owner = rule.owner ? `${rule.owner.type}:${rule.owner.id}` : null;
  const {name, url, projectSlug} = rule;
  return {owner, name, url, projectSlug};
}

export function UptimeAlertForm({
  apiMethod,
  apiUrl,
  project,
  onSubmitSuccess,
  handleDelete,
  rule,
}: Props) {
  const initialData = rule ? getFormDataFromRule(rule) : {projectSlug: project.slug};

  return (
    <UptimeForm
      apiMethod={apiMethod}
      apiEndpoint={apiUrl}
      saveOnBlur={false}
      initialData={initialData}
      onSubmitSuccess={onSubmitSuccess}
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
      <Alert type="info" showIcon icon={<IconLab />}>
        {t(
          'Uptime Monitoring is currently in Early Access. Additional configuration options will be available soon.'
        )}
      </Alert>
      <List symbol="colored-numeric">
        <AlertListItem>{t('Select an environment and project')}</AlertListItem>
        <FormRow>
          <SentryProjectSelectorField
            disabled
            name="projectSlug"
            label={t('Project')}
            hideLabel
            projects={[project]}
            valueIsSlug
            inline={false}
            flexibleControlStateSize
            stacked
          />
          <SelectField
            disabled
            name="environment"
            label={t('Environment')}
            hideLabel
            placeholder={t('Production')}
            inline={false}
            flexibleControlStateSize
            stacked
          />
        </FormRow>
        <AlertListItem>{t('Set a URL to monitor')}</AlertListItem>
        <FormRow>
          <TextField
            disabled
            name="url"
            label={t('URL')}
            hideLabel
            placeholder={t('The URL to monitor')}
            inline={false}
            flexibleControlStateSize
            stacked
          />
        </FormRow>
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
    </UptimeForm>
  );
}

const UptimeForm = styled(Form)`
  ${FieldWrapper} {
    padding: 0;
  }
`;

const AlertListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const FormRow = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  align-items: center;
  gap: ${space(2)};
`;
