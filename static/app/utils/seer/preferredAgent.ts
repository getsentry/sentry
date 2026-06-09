import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {queryOptions} from '@tanstack/react-query';
import invariant from 'invariant';

import {
  CodingAgentProvider,
  PROVIDER_TO_HANDOFF_TARGET,
} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {
  AutofixAgentSelectOption,
  AgentIntegration,
  PreferredAgentProvider,
} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

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

/**
 * Fetch the list of existing coding agent integrations.
 */
export function knownAgentIntegrationsQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  const mapProvider = {
    cursor: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
    claude_code: CodingAgentProvider.CLAUDE_CODE_AGENT,
    github_copilot: CodingAgentProvider.GITHUB_COPILOT_AGENT,
  } as const;

  return queryOptions({
    ...apiOptions.as<{
      integrations: CodingAgentIntegration[];
    }>()('/organizations/$organizationIdOrSlug/integrations/coding-agents/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 5 * 60 * 1000,
    }),
    select: (data): AgentIntegration[] => [
      ...(data.json.integrations ?? [])
        .filter(integration => integration.id)
        .map(integration => {
          return {
            ...integration,
            provider: mapProvider[integration.provider],
          };
        }),
    ],
  });
}

/**
 * Convert the list of known agents to a list of options for a select component.
 *
 * This returns a hard-coding list of agents that don't have requires_identity
 * set to true; those are the ones that we Seer can use in the background.
 */
export function useSeerAgentSelectOptions() {
  const organization = useOrganization();
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );

  return useMemo(() => {
    return [
      {value: 'seer' as const, label: t('Seer')},
      ...(knownAgents ?? [])
        .filter(i => isPreferredAgentProvider(i.provider))
        .map(i => ({
          value: `${i.provider}::${i.id}` as AutofixAgentSelectOption,
          label: i.name,
        })),
    ];
  }, [knownAgents]);
}

export function useOrgDefaultAgent() {
  const organization = useOrganization();
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );

  return useMemo((): 'seer' | AgentIntegration => {
    if (organization.defaultCodingAgentIntegrationId) {
      const match = knownAgents?.find(
        i => i.id === String(organization.defaultCodingAgentIntegrationId)
      );
      if (match) {
        return match;
      }
    }
    return 'seer';
  }, [organization.defaultCodingAgentIntegrationId, knownAgents]);
}

/**
 * Builds the automation_handoff payload for a given agent.
 * Returns undefined for Seer (no external handoff needed).
 */
export function buildHandoffPayload(
  agent: 'seer' | AgentIntegration,
  autoCreatePr: boolean
): ProjectSeerPreferences['automation_handoff'] {
  if (agent === 'seer') {
    return undefined;
  }
  const target = PROVIDER_TO_HANDOFF_TARGET[agent.provider];
  return target
    ? {
        handoff_point: 'root_cause',
        target,
        integration_id: Number(agent.id),
        auto_create_pr: autoCreatePr,
      }
    : undefined;
}

/**
 * Returns the list of coding agent integrations formatted as select options,
 * with Seer Agent as the first/default option.
 */
export function getCodingAgentSelectQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return queryOptions({
    ...organizationIntegrationsCodingAgents(organization),
    select: (data): Array<{label: string; value: 'seer' | CodingAgentIntegration}> => [
      {value: 'seer', label: t('Seer Agent')},
      ...(data.json.integrations ?? [])
        .filter(integration => integration.id)
        .map(integration => ({value: integration, label: integration.name})),
    ],
  });
}
