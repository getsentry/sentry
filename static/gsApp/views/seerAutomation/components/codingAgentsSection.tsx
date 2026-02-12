import {useMemo} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import SelectField from 'sentry/components/forms/fields/selectField';
import FormField from 'sentry/components/forms/formField';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS} from 'getsentry/views/seerAutomation/components/projectDetails/constants';

const SEER_OPTION_VALUE = '__seer__';

interface Props {
  canWrite: boolean;
}

/**
 * Parse the org's defaultAutomationHandoff JSON string into target/integration_id.
 */
function parseHandoffValue(json: string | null | undefined): {
  target: string;
  integrationId?: number;
} {
  if (!json) {
    return {target: 'seer_coding_agent'};
  }
  try {
    const parsed = JSON.parse(json);
    return {
      target: parsed.target ?? 'seer_coding_agent',
      integrationId: parsed.integration_id,
    };
  } catch {
    return {target: 'seer_coding_agent'};
  }
}

/**
 * Convert a select value back to JSON string for the org option.
 */
function handoffToJson(value: string, integrations: CodingAgentIntegration[]): string {
  if (value === SEER_OPTION_VALUE) {
    return JSON.stringify({target: 'seer_coding_agent'});
  }
  const integration = integrations.find(i => String(i.id) === value);
  if (integration) {
    return JSON.stringify({
      target: 'cursor_background_agent',
      integration_id: Number(value),
    });
  }
  return JSON.stringify({target: 'seer_coding_agent'});
}

export default function CodingAgentsSection({canWrite}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const {data: codingAgentIntegrations, isLoading} = useCodingAgentIntegrations();

  const supportedIntegrations = useMemo(
    () =>
      codingAgentIntegrations?.integrations.filter(
        integration =>
          (SUPPORTED_CODING_AGENT_INTEGRATION_PROVIDERS as unknown as string[]).includes(
            integration.provider
          ) && !integration.requires_identity
      ) ?? [],
    [codingAgentIntegrations]
  );

  // For the default selector, only show integrations that don't require per-user identity
  const selectOptions = useMemo(
    () => [
      {
        value: SEER_OPTION_VALUE,
        label: t('Seer (default)'),
      },
      ...supportedIntegrations.map(integration => ({
        value: String(integration.id),
        label: integration.name,
        leadingItems: <PluginIcon pluginId={integration.provider} size={16} />,
      })),
    ],
    [supportedIntegrations]
  );

  // Determine current select value from org option
  const handoff = parseHandoffValue(organization.defaultAutomationHandoff);
  let currentValue = SEER_OPTION_VALUE;
  if (
    handoff.target === 'cursor_background_agent' &&
    handoff.integrationId !== undefined
  ) {
    currentValue = String(handoff.integrationId);
  }

  return (
    <Panel>
      <PanelHeader>{t('Coding Agents')}</PanelHeader>
      <PanelBody>
        {isLoading ? (
          <Flex justify="center" align="center" padding="xl">
            <Placeholder height="52px" />
          </Flex>
        ) : (
          <Stack>
            <ProviderCards
              organization={organization}
              supportedIntegrations={supportedIntegrations}
              allIntegrations={codingAgentIntegrations?.integrations ?? []}
            />
            <SelectField
              disabled={!canWrite}
              name="defaultAutomationHandoff"
              label={t('Default Coding Agent for New Projects')}
              help={tct(
                'New projects will use this coding agent by default. You can override this per-project in [link:project settings].',
                {
                  link: (
                    <ExternalLink
                      href={`/settings/${organization.slug}/seer/projects/`}
                    />
                  ),
                }
              )}
              options={selectOptions}
              value={currentValue}
              onChange={(value: string) => {
                const json = handoffToJson(value, supportedIntegrations);
                api
                  .requestPromise(`/organizations/${organization.slug}/`, {
                    method: 'PUT',
                    data: {defaultAutomationHandoff: json},
                  })
                  .then(() => {
                    addSuccessMessage(t('Updated default coding agent'));
                    // Update org in-memory so re-renders reflect the change
                    organization.defaultAutomationHandoff = json;
                  })
                  .catch(() => {
                    addErrorMessage(t('Failed to update default coding agent'));
                  });
              }}
            />
          </Stack>
        )}
      </PanelBody>
    </Panel>
  );
}

function ProviderCards({
  organization,
  supportedIntegrations,
  allIntegrations,
}: {
  allIntegrations: CodingAgentIntegration[];
  organization: Organization;
  supportedIntegrations: CodingAgentIntegration[];
}) {
  const providers: React.ReactNode[] = [];

  // Cursor card
  if (organization.features.includes('integrations-cursor')) {
    const isInstalled = supportedIntegrations.some(i => i.provider === 'cursor');
    providers.push(
      <ProviderCard
        key="cursor"
        provider="cursor"
        name={t('Cursor')}
        description={t(
          'Hand off root cause analysis to Cursor Cloud Agent for code changes.'
        )}
        isInstalled={isInstalled}
        installUrl={`/settings/${organization.slug}/integrations/cursor/`}
      />
    );
  }

  // GitHub Copilot card
  if (organization.features.includes('integrations-github-copilot-agent')) {
    const copilotIntegration = allIntegrations.find(i => i.provider === 'github_copilot');
    const isAvailable = !!copilotIntegration;
    providers.push(
      <ProviderCard
        key="github_copilot"
        provider="github_copilot"
        name={t('GitHub Copilot')}
        description={t(
          'Hand off root cause analysis to GitHub Copilot coding agent. Requires per-user setup.'
        )}
        isInstalled={isAvailable}
        requiresIdentity
      />
    );
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <FormField
      name="codingAgentProviders"
      label={t('Available Providers')}
      help={tct(
        'Install coding agent integrations to use them for automated fixes. [docsLink:Read the docs] to learn more.',
        {
          docsLink: (
            <ExternalLink href="https://docs.sentry.io/organization/integrations/cursor/" />
          ),
        }
      )}
    >
      {() => <Stack gap="md">{providers}</Stack>}
    </FormField>
  );
}

function ProviderCard({
  provider,
  name,
  description,
  isInstalled,
  installUrl,
  requiresIdentity,
}: {
  description: string;
  isInstalled: boolean;
  name: string;
  provider: string;
  installUrl?: string;
  requiresIdentity?: boolean;
}) {
  return (
    <Flex align="center" gap="md">
      <PluginIcon pluginId={provider} size={32} />
      <Stack gap="xs" style={{flex: 1}}>
        <Flex align="center" gap="sm">
          <Text bold>{name}</Text>
          {requiresIdentity && (
            <Text size="xs" variant="muted">
              {t('Per-user setup')}
            </Text>
          )}
        </Flex>
        <Text size="sm" variant="muted">
          {description}
        </Text>
      </Stack>
      {isInstalled ? (
        <Text size="sm" bold>
          {t('Installed')}
        </Text>
      ) : installUrl ? (
        <LinkButton href={installUrl} priority="default" size="sm">
          {t('Install')}
        </LinkButton>
      ) : null}
    </Flex>
  );
}
