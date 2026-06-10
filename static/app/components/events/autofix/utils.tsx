import {useCallback, useMemo} from 'react';

import {
  CodingAgentProvider,
  DiffFileType,
  DiffLineType,
  type FilePatch,
  type SeerAutomationHandoffConfiguration,
} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {isArrayOf} from 'sentry/types/utils';
import {useOrganization} from 'sentry/utils/useOrganization';

const AUTOFIX_TTL_IN_DAYS = 30;

export const PROVIDER_TO_HANDOFF_TARGET: Record<
  string,
  SeerAutomationHandoffConfiguration['target']
> = {
  cursor: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
  claude_code: CodingAgentProvider.CLAUDE_CODE_AGENT,
  github_copilot: CodingAgentProvider.GITHUB_COPILOT_AGENT,
};

export function getResultButtonLabel(url: string | null | undefined): string {
  if (url?.includes('/tree/')) {
    return t('View Branch');
  }
  return t('View Pull Request');
}

export function getCodingAgentName(provider: string | undefined): string {
  switch (provider) {
    case CodingAgentProvider.CURSOR_BACKGROUND_AGENT:
      return t('Cursor Cloud Agent');
    case CodingAgentProvider.CLAUDE_CODE_AGENT:
      return t('Claude Agent');
    case CodingAgentProvider.GITHUB_COPILOT_AGENT:
      return t('GitHub Copilot');
    default:
      return t('Coding Agent');
  }
}

function isDiffFileType(value: unknown): value is DiffFileType {
  return (
    value === DiffFileType.ADDED ||
    value === DiffFileType.MODIFIED ||
    value === DiffFileType.DELETED
  );
}

function isDiffLineType(value: unknown): value is DiffLineType {
  return (
    value === DiffLineType.ADDED ||
    value === DiffLineType.REMOVED ||
    value === DiffLineType.CONTEXT
  );
}

function isDiffLine(
  value: unknown
): value is FilePatch['hunks'][number]['lines'][number] {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    (typeof obj.diff_line_no === 'number' || obj.diff_line_no === null) &&
    isDiffLineType(obj.line_type) &&
    (typeof obj.source_line_no === 'number' || obj.source_line_no === null) &&
    (typeof obj.target_line_no === 'number' || obj.target_line_no === null) &&
    typeof obj.value === 'string'
  );
}

function isHunk(value: unknown): value is FilePatch['hunks'][number] {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    isArrayOf(obj.lines, isDiffLine) &&
    typeof obj.section_header === 'string' &&
    typeof obj.source_length === 'number' &&
    typeof obj.source_start === 'number' &&
    typeof obj.target_length === 'number' &&
    typeof obj.target_start === 'number'
  );
}

export function isFilePatch(value: unknown): value is FilePatch {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.added === 'number' &&
    isArrayOf(obj.hunks, isHunk) &&
    typeof obj.path === 'string' &&
    typeof obj.removed === 'number' &&
    typeof obj.source_file === 'string' &&
    typeof obj.target_file === 'string' &&
    isDiffFileType(obj.type)
  );
}

const BASE_SUPPORTED_PROVIDERS = [
  'github',
  'integrations:github',
  'github_enterprise',
  'integrations:github_enterprise',
];

/**
 * Feature-gated providers. Each entry maps a feature flag to the provider IDs
 * it unlocks. Add new providers here as they become supported.
 */
const FEATURE_GATED_PROVIDERS: Array<{
  flag: string;
  providerIds: string[];
}> = [
  {
    flag: 'seer-gitlab-support',
    providerIds: ['gitlab', 'integrations:gitlab'],
  },
];

/**
 * Pure function for non-hook contexts (e.g. buildIntegrationTreeNodes).
 * Returns true if the provider is in the supported list.
 */
export function isSeerSupportedProvider(
  provider: {id: string; name: string},
  supportedProviderIds: string[]
): boolean {
  return supportedProviderIds.includes(provider.id);
}

/**
 * Returns the list of provider IDs supported for Seer based on the
 * organization's feature flags. To support a new provider, add an entry
 * to FEATURE_GATED_PROVIDERS above.
 */
export function useSeerSupportedProviderIds(): string[] {
  const organization = useOrganization();
  return useMemo(() => {
    const ids = [...BASE_SUPPORTED_PROVIDERS];
    for (const {flag, providerIds} of FEATURE_GATED_PROVIDERS) {
      if (organization.features.includes(flag)) {
        ids.push(...providerIds);
      }
    }
    return ids;
  }, [organization.features]);
}

/**
 * Convenience hook that returns a provider-check callback.
 * Use this in React components that need to test individual providers.
 */
export function useIsSeerSupportedProvider(): (provider: {
  id: string;
  name: string;
}) => boolean {
  const supportedProviderIds = useSeerSupportedProviderIds();
  return useCallback(
    (provider: {id: string; name: string}) =>
      isSeerSupportedProvider(provider, supportedProviderIds),
    [supportedProviderIds]
  );
}

export function getAutofixRunExists(group: Group) {
  const autofixLastRunAsDate = group.seerAutofixLastTriggered
    ? new Date(group.seerAutofixLastTriggered)
    : null;
  const autofixRanWithinTtl = autofixLastRunAsDate
    ? autofixLastRunAsDate >
      new Date(Date.now() - AUTOFIX_TTL_IN_DAYS * 24 * 60 * 60 * 1000)
    : false;

  return autofixRanWithinTtl;
}

export function isIssueQuickFixable(group: Group) {
  return group.seerFixabilityScore && group.seerFixabilityScore > 0.7;
}
