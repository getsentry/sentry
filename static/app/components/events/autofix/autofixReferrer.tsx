import {t} from 'sentry/locale';
import type {Block} from 'sentry/views/seerExplorer/types';

interface ReferrerConfig {
  pattern: RegExp;
  tooltip: string | undefined;
}

const FALLBACK_CONFIG = {
  pattern: /^.*/,
  tooltip: undefined,
};

const REFERRER_CONFIG: ReferrerConfig[] = [
  {
    pattern: /^api\.group_ai_autofix$/,
    tooltip: t('Manually triggered'),
  },
  {
    pattern: /^issue_summary\.alert_fixability$/,
    tooltip: t('Auto-triggered from alert'),
  },
  {
    pattern: /^issue_summary\.post_process_fixability$/,
    tooltip: t('Auto-triggered on event ingestion'),
  },
  {
    pattern: /^issue_summary\./,
    tooltip: t('Auto-triggered from issue summary'),
  },
  {pattern: /^slack$/, tooltip: t('Triggered from Slack')},
  {
    pattern: /^autofix\.on_completion_hook$/,
    tooltip: t('Triggered from completion hook'),
  },
  {pattern: /^night_shift$/, tooltip: t('Triggered by agentic triage')},
  {pattern: /^api\.cli$/, tooltip: t('Triggered by the Sentry CLI')},
  {pattern: /^api\.linear_agent$/, tooltip: t('Triggered from Linear')},
  {pattern: /^api\.mcp$/, tooltip: t('Triggered by the Sentry MCP')},
  {pattern: /^api\.web$/, tooltip: t('Manually triggered')},
  FALLBACK_CONFIG,
];

/**
 * Iterates through explorer blocks and returns the first referrer found in metadata.
 */
export function getReferrerFromBlocks(blocks: Block[]): string | undefined {
  for (const block of blocks) {
    const referrer = block.message?.metadata?.referrer;
    if (referrer) {
      return referrer;
    }
  }
  return undefined;
}

/**
 * Returns the matching referrer config for a given referrer string.
 * Tries each pattern in REFERRER_CONFIG in order and returns the first match.
 * Returns undefined if no referrer is provided or no pattern matches.
 */
export function getReferrerConfig(
  referrer: string | undefined
): Readonly<ReferrerConfig> {
  if (!referrer) {
    return FALLBACK_CONFIG;
  }

  for (const config of REFERRER_CONFIG) {
    if (config.pattern.test(referrer)) {
      return config;
    }
  }

  return FALLBACK_CONFIG;
}
