import {queryOptions} from '@tanstack/react-query';
import {parseAsStringEnum} from 'nuqs';

import {
  CodingAgentProvider,
  getCodingAgentName,
} from 'sentry/components/events/autofix/types';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

export type PreferredAgentProvider = 'seer' | CodingAgentProvider;

/**
 * Convert from the format that is returned by the /integrations/coding-agents/
 * endpoint to the labels that are used with /autofix/automation-settings/.
 */
function convertAgentNameToCodingAgentProvider(name: string): PreferredAgentProvider {
  switch (name) {
    case CodingAgentProvider.CLAUDE_CODE_AGENT:
    case 'claude_code':
      return CodingAgentProvider.CLAUDE_CODE_AGENT;
    case CodingAgentProvider.CURSOR_BACKGROUND_AGENT:
    case 'cursor':
      return CodingAgentProvider.CURSOR_BACKGROUND_AGENT;
    case CodingAgentProvider.GITHUB_COPILOT_AGENT:
    case 'github_copilot':
      return CodingAgentProvider.GITHUB_COPILOT_AGENT;
    case 'seer':
    default:
      return 'seer';
  }
}

export function getFilteredCodingAgentName(provider: undefined | string): string {
  if (!provider || provider === 'seer') {
    return t('Seer Agent');
  }
  return getCodingAgentName(provider);
}

export const preferredAgentFilterParser = parseAsStringEnum([
  'seer',
  ...Object.values(CodingAgentProvider),
]);

/**
 * Returns the list of coding agent integrations formatted as select options,
 * with Seer Agent as the first/default option.
 */
export function filterCodingAgentQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return queryOptions({
    ...organizationIntegrationsCodingAgents(organization),
    select: (
      data
    ): Array<{label: React.ReactNode; value: '' | PreferredAgentProvider}> => {
      if (data.json.integrations.length) {
        return [
          {value: '', label: 'All'},
          {value: 'seer', label: t('Seer Agent')},
          ...(data.json.integrations ?? [])
            .filter(integration => integration.id)
            .map(integration => ({
              value: convertAgentNameToCodingAgentProvider(integration.provider),
              label: integration.name,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ];
      }
      return [];
    },
  });
}
