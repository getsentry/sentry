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

  if (supportedIntegrations.length === 0) {
    // There are no supported integrations, so we don't need to show anything
    // Users will need to add an integration first (See <BackgroundAgentSetup />)
    return null;
  }
  if (supportedIntegrations.length === 1) {
    switch (supportedIntegrations[0]?.provider) {
      case 'cursor':
        return (
          <BooleanField
            disabled={!canWrite}
            name="connectCursorIntegration"
            label={
              <Flex align="center" gap="sm">
                <PluginIcon pluginId="cursor" />
                <Text>{t('Hand off to Cursor Cloud Agent')}</Text>
              </Flex>
            }
            help={tct(
              '[docsLink:Read the docs] to learn more about Cursor Cloud Agents integration.',
              {
                docsLink: (
                  <ExternalLink href="https://docs.sentry.io/organization/integrations/cursor/" />
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
                        integration_id: Number(supportedIntegrations[0]?.id),
                        auto_create_pr: false,
                      }
                    : undefined,
                },
                {
                  onSuccess: () =>
                    addSuccessMessage(
                      value
                        ? t(
                            'Started using %s background agent',
                            supportedIntegrations[0]?.name
                          )
                        : t(
                            'Stopped using %s background agent',
                            supportedIntegrations[0]?.name
                          )
                    ),
                  onError: () =>
                    addErrorMessage(
                      t(
                        'Failed to enable %s background agent',
                        supportedIntegrations[0]?.name
                      )
                    ),
                }
              );
            }}
          />
        );
      default:
        // TODO: Add another SwitchField for other integrations
        return null;
    }
  }

  const options = supportedIntegrations.map(integration => ({
    value: integration.id,
    label: `${integration.name} (${integration.id})`,
  }));

  return (
    <SelectField
      disabled={!canWrite}
      name="integrationId"
      label={t('Coding Agent Integration')}
      allowEmpty
      allowClear
      options={options}
      value={preference?.automation_handoff?.integration_id}
      onChange={value => {
        updateProjectSeerPreferences(
          {
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: value
              ? {
                  handoff_point: 'root_cause',
                  target: 'cursor_background_agent',
                  integration_id: Number(supportedIntegrations[0]?.id),
                  auto_create_pr: false,
                }
              : undefined,
          },
          {
            onSuccess: () =>
              addSuccessMessage(
                t('Enabled %s background agent', supportedIntegrations[0]?.name)
              ),
            onError: () =>
              addErrorMessage(
                t('Failed to enable %s background agent', supportedIntegrations[0]?.name)
              ),
          }
        );
      }}
    />
  );
}
