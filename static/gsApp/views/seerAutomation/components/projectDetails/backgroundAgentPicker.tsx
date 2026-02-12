import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import SelectField from 'sentry/components/forms/fields/selectField';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Project} from 'sentry/types/project';

const SEER_OPTION_VALUE = '__seer__';

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

  // Determine current value
  const handoff = preference?.automation_handoff;
  let currentValue = SEER_OPTION_VALUE;
  if (handoff?.target === 'cursor_background_agent' && handoff?.integration_id != null) {
    currentValue = String(handoff.integration_id);
  }

  const options = [
    {
      value: SEER_OPTION_VALUE,
      label: t('Seer (default)'),
    },
    ...supportedIntegrations.map(integration => ({
      value: String(integration.id),
      label: integration.name,
      leadingItems: <PluginIcon pluginId={integration.provider} size={16} />,
    })),
  ];

  return (
    <SelectField
      disabled={isDisabled}
      disabledReason={disabledReason ?? undefined}
      name="codingAgent"
      label={t('Coding Agent')}
      help={tct(
        'Choose which coding agent handles solutions and fixes after root cause analysis. [docsLink:Read the docs] to learn more.',
        {
          docsLink: <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/" />,
        }
      )}
      options={options}
      value={currentValue}
      onChange={(value: string) => {
        const isSeer = value === SEER_OPTION_VALUE;
        const integration = supportedIntegrations.find(i => String(i.id) === value);

        updateProjectSeerPreferences(
          {
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: isSeer
              ? {
                  handoff_point: 'root_cause',
                  target: 'seer_coding_agent',
                }
              : {
                  handoff_point: 'root_cause',
                  target: 'cursor_background_agent',
                  integration_id: Number(value),
                },
          },
          {
            onSuccess: () =>
              addSuccessMessage(
                isSeer
                  ? t('Set Seer as coding agent')
                  : tct('Set [name] as coding agent', {
                      name: <strong>{integration?.name ?? value}</strong>,
                    })
              ),
            onError: () => addErrorMessage(t('Failed to update coding agent')),
          }
        );
      }}
    />
  );
}
