import {Flex} from '@sentry/scraps/layout/flex';
import {ExternalLink} from '@sentry/scraps/link/link';
import {Text} from '@sentry/scraps/text/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Project} from 'sentry/types/project';

import type {SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS} from 'getsentry/views/seerAutomation/components/projectDetails/constants';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
  supportedIntegrations: CodingAgentIntegration[];
}

export default function BackgroundAgentPicker({
  canWrite,
  preference,
  project,
  supportedIntegrations,
}: Props) {
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const isAutoTriggeredFixesEnabled = Boolean(
    project.autofixAutomationTuning && project.autofixAutomationTuning !== 'off'
  );

  const isDisabled = !canWrite || !isAutoTriggeredFixesEnabled;

  let disabledReason: string | null = null;
  if (!isAutoTriggeredFixesEnabled) {
    disabledReason = t('Turn on Auto-Triggered Fixes to use this feature.');
  }

  if (supportedIntegrations.length === 0) {
    // There are no supported integrations, so we don't need to show anything
    // Users will need to add an integration first (See <BackgroundAgentSetup />)
    return null;
  }
  if (supportedIntegrations.length === 1) {
    const integration = supportedIntegrations[0]!;
    const provider =
      integration.provider as (typeof SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS)[number];

    switch (provider) {
      case 'cursor':
        return (
          <BooleanField
            disabled={isDisabled}
            disabledReason={disabledReason ?? undefined}
            name="connectCursorIntegration"
            label={
              <Flex align="center" gap="sm">
                <PluginIcon pluginId="cursor" />
                <Text>{t('Hand off to Cursor Cloud Agent')}</Text>
              </Flex>
            }
            help={tct(
              'Seer will identify the root cause and hand off to an external coding agent for solutions and fixes. [docsLink:Read the docs] to learn more.',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />
                ),
              }
            )}
            value={preference?.automation_handoff?.target === 'cursor_background_agent'}
            onChange={value => {
              updateProjectSeerPreferences(
                {
                  repositories: preference?.repositories || [],
                  automated_run_stopping_point: preference?.automated_run_stopping_point,
                  automation_handoff: value
                    ? {
                        handoff_point: 'root_cause',
                        target: 'cursor_background_agent',
                        integration_id: Number(integration.id),
                        auto_create_pr: false,
                      }
                    : undefined,
                },
                {
                  onSuccess: () =>
                    addSuccessMessage(
                      value
                        ? tct('Started using [name] background agent', {
                            name: <strong>{integration.name}</strong>,
                          })
                        : tct('Stopped using [name] background agent', {
                            name: <strong>{integration.name}</strong>,
                          })
                    ),
                  onError: () =>
                    addErrorMessage(
                      tct('Failed to enable [name] background agent', {
                        name: <strong>{integration.name}</strong>,
                      })
                    ),
                }
              );
            }}
          />
        );
      default:
        // Add more SwitchFields for other integrations here
        return null;
    }
  }

  const options = supportedIntegrations.map(integration => ({
    value: integration,
    label: `${integration.name} (${integration.id})`,
  }));

  return (
    <SelectField
      disabled={isDisabled}
      disabledReason={disabledReason ?? undefined}
      name="integrationId"
      label={t('Coding Agent Integration')}
      help={tct(
        'Seer will identify the root cause and hand off to an external coding agent for solutions and fixes. [docsLink:Read the docs] to learn more.',
        {
          docsLink: <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />,
        }
      )}
      allowEmpty
      allowClear
      options={options}
      value={supportedIntegrations.find(
        integration =>
          integration.id === String(preference?.automation_handoff?.integration_id)
      )}
      onChange={(integration: CodingAgentIntegration | undefined) => {
        updateProjectSeerPreferences(
          {
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: integration
              ? {
                  handoff_point: 'root_cause',
                  target: 'cursor_background_agent',
                  integration_id: Number(integration.id),
                  auto_create_pr: false,
                }
              : undefined,
          },
          {
            onSuccess: () =>
              addSuccessMessage(
                integration
                  ? tct('Started using [name] background agent', {
                      name: <strong>{integration.name}</strong>,
                    })
                  : t('Stopped using background agent')
              ),
            onError: () =>
              addErrorMessage(
                integration
                  ? tct('Failed to enable [name] background agent', {
                      name: <strong>{integration.name}</strong>,
                    })
                  : t('Failed to disable background agent')
              ),
          }
        );
      }}
    />
  );
}
