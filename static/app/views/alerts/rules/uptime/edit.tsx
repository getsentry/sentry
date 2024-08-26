import {useEffect} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {UptimeAlert} from 'sentry/views/alerts/types';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = {
  onChangeTitle: (data: string) => void;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
} & RouteComponentProps<RouteParams, {}>;

export function UptimeRulesEdit({params, onChangeTitle, organization, project}: Props) {
  const api = useApi();
  const navigate = useNavigate();

  const apiUrl = `/projects/${organization.slug}/${params.projectId}/uptime/${params.ruleId}/`;

  const {
    isLoading,
    isSuccess,
    isError,
    data: rule,
    error,
  } = useApiQuery<UptimeAlert>([apiUrl], {
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (isSuccess && rule) {
      onChangeTitle(rule.name ?? '');
    }
  }, [onChangeTitle, isSuccess, rule]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    if (error?.status === 404) {
      return (
        <Alert type="error" showIcon>
          {t('This alert rule could not be found.')}
        </Alert>
      );
    }

    return <LoadingError />;
  }

  const handleDelete = async () => {
    try {
      await api.requestPromise(apiUrl, {method: 'DELETE'});
      navigate(normalizeUrl(`/organizations/${organization.slug}/alerts/rules/`));
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  const {name, url, projectSlug} = rule;
  const owner = rule?.owner ? `${rule.owner.type}:${rule.owner.id}` : null;

  return (
    <UptimeForm
      apiMethod="PUT"
      apiEndpoint={apiUrl}
      saveOnBlur={false}
      initialData={{projectSlug, url, name, owner}}
      onSubmitSuccess={() => {
        navigate(
          normalizeUrl(
            `/organizations/${organization.slug}/alerts/rules/uptime/${params.projectId}/${params.ruleId}/details`
          )
        );
      }}
      extraButton={
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
