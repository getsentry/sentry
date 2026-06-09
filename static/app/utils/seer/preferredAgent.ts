import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {queryOptions} from '@tanstack/react-query';

import {
  CodingAgentProvider,
  PROVIDER_TO_HANDOFF_TARGET,
} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {SeerAgent} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

export type PreferredAgentIntegration = 'seer' | CodingAgentIntegration;

/**
 * Fetch the list of existing coding agent integrations.
 */
export function useKnownAgents() {
  const organization = useOrganization();
  const agentOptions = useQuery(getCodingAgentSelectQueryOptions({organization}));

  return useMemo(
    () =>
      (agentOptions.data ?? [])
        .filter(
          (o): o is {label: string; value: CodingAgentIntegration} => o.value !== 'seer'
        )
        .map(o => o.value),
    [agentOptions.data]
  );
}

/**
 * Convert the list of known agents to a list of options for a select component.
 *
 * This returns a hard-coding list of agents that don't have requires_identity
 * set to true; those are the ones that we Seer can use in the background.
 */
export function useSeerAgentSelectOptions() {
  const integrations = useKnownAgents();

  return useMemo((): Array<{label: string; value: SeerAgent}> => {
    return [
      {value: 'seer' as const, label: t('Seer')},
      {
        value: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
        label: integrations.find(i => i.provider === 'cursor')?.name ?? t('Cursor'),
      },
      {
        value: CodingAgentProvider.CLAUDE_CODE_AGENT,
        label: integrations.find(i => i.provider === 'claude_code')?.name ?? t('Claude'),
      },
    ];
  }, [integrations]);
}

export function useOrgDefaultAgent() {
  const organization = useOrganization();
  const integrations = useKnownAgents();

  return useMemo((): PreferredAgentIntegration => {
    if (organization.defaultCodingAgentIntegrationId) {
      const match = integrations.find(
        i => i.id === String(organization.defaultCodingAgentIntegrationId)
      );
      if (match) {
        return match;
      }
    }
    return 'seer';
  }, [organization.defaultCodingAgentIntegrationId, integrations]);
}

/**
 * Builds the automation_handoff payload for a given agent.
 * Returns undefined for Seer (no external handoff needed).
 */
export function buildHandoffPayload(
  agent: PreferredAgentIntegration,
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
    select: (data): Array<{label: string; value: PreferredAgentIntegration}> => [
      {value: 'seer', label: t('Seer Agent')},
      ...(data.json.integrations ?? [])
        .filter(integration => integration.id)
        .map(integration => ({value: integration, label: integration.name})),
    ],
  });
}
