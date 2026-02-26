import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
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

export default function CursorAgentSettings({
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
      name="cursorAutoCreatePullRequests"
      label={t('Auto-Create Pull Requests')}
      help={t(
        'When enabled, Cursor Cloud Agents will automatically create pull requests after hand off.'
      )}
      value={preference?.automation_handoff?.auto_create_pr ?? false}
      onChange={(value: boolean) => {
        updateProjectSeerPreferences(
          {
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point, // Seer Agent "Create PR" setting
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: Number(integration.id),
              ...preference?.automation_handoff,
              auto_create_pr: value, // External coding agent "Create PR" setting
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
