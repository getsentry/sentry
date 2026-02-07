import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}

/**
 * Toggle for allowing PR auto creation within the Seer Agent section.
 * This is disabled when an external coding agent is configured.
 */
export default function SeerAgentSection({canWrite, project, preference}: Props) {
  const organization = useOrganization();
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const isAutoFixEnabled = Boolean(
    project.autofixAutomationTuning && project.autofixAutomationTuning !== 'off'
  );
  const isCreatePrEnabled = Boolean(
    preference?.automated_run_stopping_point &&
    preference.automated_run_stopping_point !== 'code_changes'
  );
  const isBackgroundAgentEnabled = Boolean(preference?.automation_handoff);

  const isDisabled =
    organization.enableSeerCoding === false ||
    !canWrite ||
    !isAutoFixEnabled ||
    isBackgroundAgentEnabled;

  let disabledReason: string | null = null;
  if (organization.enableSeerCoding === false) {
    disabledReason = t(
      'Turn on [settings:"Enable Code Generation"] to use this feature.',
      {
        settings: <Link to={`/settings/${organization.slug}/seer/#enableSeerCoding`} />,
      }
    );
  } else if (!isAutoFixEnabled) {
    disabledReason = t('Turn on Auto-Triggered Fixes to use this feature.');
  } else if (isBackgroundAgentEnabled) {
    disabledReason = t(
      'This setting is not available when using an external coding agent.'
    );
  }

  return (
    <BooleanField
      disabled={isDisabled}
      disabledReason={disabledReason ?? undefined}
      name="automated_run_stopping_point"
      label={t('Allow PR Auto Creation')}
      help={
        <Stack gap="sm">
          <span>
            {tct(
              'Seer will identify the root cause and propose a solution for error and performance issues. [docsLink:Read the docs] to learn more.',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />
                ),
              }
            )}
          </span>
          {organization.enableSeerCoding === false && (
            <Alert variant="warning">
              {tct(
                '[settings:"Enable Code Generation"] must be enabled for Seer to create pull requests.',
                {
                  settings: (
                    <Link to={`/settings/${organization.slug}/seer/#enableSeerCoding`} />
                  ),
                }
              )}
            </Alert>
          )}
        </Stack>
      }
      value={organization.enableSeerCoding !== false && isCreatePrEnabled}
      onChange={value => {
        const newValue: ProjectSeerPreferences['automated_run_stopping_point'] = value
          ? 'open_pr'
          : 'code_changes';
        updateProjectSeerPreferences(
          {
            repositories: preference?.repositories || [],
            automated_run_stopping_point: newValue,
            automation_handoff: preference?.automation_handoff,
          },
          {
            onSuccess: () =>
              addSuccessMessage(
                value ? t('Enabled PR auto creation') : t('Disabled PR auto creation')
              ),
            onError: () =>
              addErrorMessage(t('Failed to update PR auto creation setting')),
          }
        );
      }}
    />
  );
}
