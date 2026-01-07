import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

import type {SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS} from 'getsentry/views/seerAutomation/components/projectDetails/constants';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
  selectedIntegration: CodingAgentIntegration;
}

export default function BackgroundAgentFields({
  canWrite,
  selectedIntegration,
  preference,
  project,
}: Props) {
  const provider =
    selectedIntegration.provider as (typeof SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS)[number];
  switch (provider) {
    case 'cursor':
      return (
        <CursorIntegrationFields
          canWrite={canWrite}
          preference={preference}
          project={project}
          selectedIntegration={selectedIntegration}
        />
      );
    default:
      // If no integration is selected, or the integration doesn't support any
      // fields: then we don't have anything to show
      return null;
  }
}

function CursorIntegrationFields({
  canWrite,
  preference,
  project,
  selectedIntegration,
}: Props) {
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  return (
    <BooleanField
      disabled={
        !canWrite || preference?.automation_handoff?.target !== 'cursor_background_agent'
      }
      name="cursorAutoCreatePullRequests"
      label={t('Auto-Create Pull Requests')}
      help={t(
        'When enabled, Cursor Cloud Agents will automatically create pull requests after hand off.'
      )}
      value={preference?.automation_handoff?.auto_create_pr ?? false}
      onChange={value => {
        updateProjectSeerPreferences(
          {
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: Number(selectedIntegration.id),
              auto_create_pr: value,
            },
          },
          {
            onSuccess: () =>
              value
                ? addSuccessMessage(
                    t('Enabled pull request creation from %s', selectedIntegration.name)
                  )
                : addSuccessMessage(
                    t('Disabled pull request creation from %s', selectedIntegration.name)
                  ),
            onError: () =>
              addErrorMessage(
                t(
                  'Error while changing pull request settings for %s',
                  selectedIntegration.name
                )
              ),
          }
        );
      }}
    />
  );
}
