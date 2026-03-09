import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

interface Props {
  canWrite: boolean;
  integration: CodingAgentIntegration;
  preference: ProjectSeerPreferences;
  project: Project;
}

export default function CodingAgentSettings({
  integration,
  canWrite,
  preference,
  project,
}: Props) {
  const disabledReason = canWrite
    ? null
    : t('You do not have permission to update this setting.');

  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  return (
    <BooleanField
      disabled={Boolean(disabledReason)}
      disabledReason={disabledReason}
      name="codingAgentAutoCreatePullRequests"
      label={t('Auto Create Pull Requests')}
      help={t(
        'When enabled, %s will automatically create pull requests after hand off.',
        integration.name
      )}
      value={preference?.automation_handoff?.auto_create_pr ?? false}
      onChange={(value: boolean) => {
        updateProjectSeerPreferences(
          {
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: {
              ...preference?.automation_handoff,
              handoff_point: 'root_cause',
              target: PROVIDER_TO_HANDOFF_TARGET[integration.provider]!,
              integration_id: Number(integration.id),
              auto_create_pr: value,
            },
          },
          {
            onSuccess: () =>
              value
                ? addSuccessMessage(t('Enabled pull request creation'))
                : addSuccessMessage(t('Disabled pull request creation')),
            onError: () =>
              addErrorMessage(t('Error while changing pull request settings')),
          }
        );
      }}
    />
  );
}
