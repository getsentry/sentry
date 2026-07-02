import {queryOptions} from '@tanstack/react-query';
import invariant from 'invariant';

import {
  CodingAgentProvider,
  PROVIDER_TO_HANDOFF_TARGET,
} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {
  AutofixAgentSelectOption,
  AgentIntegration,
  PreferredAgentProvider,
} from 'sentry/utils/seer/types';

export function coalesePreferredAgent(
  agent: 'seer' | CodingAgentProvider,
  integrationId: string | null
): AutofixAgentSelectOption {
  if (agent === 'seer') {
    return 'seer';
  }
  return `${agent}::${integrationId ?? ''}` as const;
}

export function isPreferredAgentProvider(
  provider: string | undefined
): provider is PreferredAgentProvider {
  // These are the providers where requires_identity is false. But sometimes we
  // need to check by type, not integration object. So it's a hard-coded list.
  return [
    'seer',
    CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
    CodingAgentProvider.CLAUDE_CODE_AGENT,
  ].includes(provider ?? '');
}

export function parseAgentOption(
  agentOption: AutofixAgentSelectOption,
  knownAgents: AgentIntegration[] | undefined
) {
  if (agentOption === 'seer' || !knownAgents || !agentOption.includes('::')) {
    return {agent: 'seer'} as const;
  }

  const [provider, integrationId] = agentOption.split('::');
  invariant(isPreferredAgentProvider(provider), 'Invalid agent option');
  invariant(integrationId, 'Invalid agent option');
  return {agent: provider, integrationId} as const;
}

function selectAgentIntegrations(
  data: ApiResponse<{integrations: CodingAgentIntegration[]}>
): AgentIntegration[] {
  const mapProvider = {
    cursor: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
    claude_code: CodingAgentProvider.CLAUDE_CODE_AGENT,
    github_copilot: CodingAgentProvider.GITHUB_COPILOT_AGENT,
  } as const;

  return [
    ...(data.json.integrations ?? [])
      .filter(integration => integration.id)
      .map(integration => {
        return {
          ...integration,
          provider: mapProvider[integration.provider],
        };
      }),
  ];
}

/**
 * Fetch the list of existing coding agent integrations.
 */
export function knownAgentIntegrationsQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return queryOptions({
    ...apiOptions.as<{
      integrations: CodingAgentIntegration[];
    }>()('/organizations/$organizationIdOrSlug/integrations/coding-agents/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 5 * 60 * 1000,
    }),
    select: selectAgentIntegrations,
  });
}

/**
 * Query options for a list of Agent Provider names. Formatted for use in a select component.
 *
 * This returns options like:
 * ```[
 *   {value: 'cursor_background_agent', label: 'Cursor Cloud Agent'},
 *   {value: 'claude_code_agent', label: 'Claude Code Agent'}
 * ]
 * ```
 * See Also: `seerAgentIntegrationsSelectQueryOptions()`
 *
 * Builds on `knownAgentIntegrationsQueryOptions` and overrides `select` to
 * produce `{value, label}` tuples filtered to preferred-agent integration ids.
 */
export function seerAgentProviderNameSelectQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  const labels = {
    [CodingAgentProvider.CURSOR_BACKGROUND_AGENT]: t('Cursor Cloud Agent'),
    [CodingAgentProvider.CLAUDE_CODE_AGENT]: t('Claude Code Agent'),

    // included for completeness & typechecks, but it's filtered out.
    [CodingAgentProvider.GITHUB_COPILOT_AGENT]: t('GitHub Copilot Agent'),
  };
  return queryOptions({
    ...knownAgentIntegrationsQueryOptions({organization}),
    select: data => {
      const seen = new Set<CodingAgentProvider>();
      const providerOptions: Array<{label: string; value: CodingAgentProvider}> = [];
      for (const i of selectAgentIntegrations(data)) {
        if (isPreferredAgentProvider(i.provider) && !seen.has(i.provider)) {
          seen.add(i.provider);
          providerOptions.push({value: i.provider, label: labels[i.provider]});
        }
      }
      return [{value: 'seer' as const, label: t('Seer')}, ...providerOptions];
    },
  });
}

/**
 * Query options for a list of Agent Integrations. Formatted for use in a select component.
 *
 * This returns options like:
 * ```[
 *   {value: 'cursor_background_agent::123', label: 'Cursor Cloud Agent - <email_idenfitier>'},
 *   {value: 'claude_code_agent::456', label: 'Claude Code Agent'}
 * ]
 * ```
 * See Also: `seerAgentProviderSelectQueryOptions()`
 *
 * Builds on `knownAgentIntegrationsQueryOptions` and overrides `select` to
 * produce `{value, label}` tuples filtered to preferred-agent integration ids.
 */
export function seerAgentIntegrationsSelectQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return queryOptions({
    ...knownAgentIntegrationsQueryOptions({organization}),
    select: data => [
      {value: 'seer' as const, label: t('Seer')},
      ...selectAgentIntegrations(data)
        .filter(i => isPreferredAgentProvider(i.provider)) // filter out copilot, it cannot be saved.
        .map(i => ({
          value: `${i.provider}::${i.id}` as const,
          label: i.name,
        })),
    ],
  });
}

export function orgDefaultAgentQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return queryOptions({
    ...knownAgentIntegrationsQueryOptions({organization}),
    select: (data): AutofixAgentSelectOption => {
      if (organization.defaultCodingAgentIntegrationId) {
        const match = selectAgentIntegrations(data).find(
          i => i.id === String(organization.defaultCodingAgentIntegrationId)
        );
        if (match) {
          return `${match.provider}::${match.id}` as const;
        }
      }
      return 'seer';
    },
  });
}

/**
 * Builds the automation_handoff payload for a given agent.
 * Returns undefined for Seer (no external handoff needed).
 */
export function buildHandoffPayload(
  agent: PreferredAgentProvider,
  integrationId: string | undefined,
  autoCreatePr: boolean
): ProjectSeerPreferences['automation_handoff'] {
  if (agent === 'seer') {
    return undefined;
  }
  const target = PROVIDER_TO_HANDOFF_TARGET[agent];
  return target
    ? {
        handoff_point: 'root_cause',
        target,
        integration_id: Number(integrationId),
        auto_create_pr: autoCreatePr,
      }
    : undefined;
}
