import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconBot, IconBroadcast, IconSeer, IconSiren, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {AutofixTrigger} from './types';

// The full set of triggers the UI can label. Only `manual` and `night_shift`
// are derivable today (see mapRunSourceToTrigger): they come from the runs
// list's `source` field. The `issue_summary`/`alert`/
// `post_process` buckets live on `AutofixData.request.options.auto_run_source`
// (src/sentry/seer/autofix/issue_summary.py), which the runs list response
// doesn't expose — they're kept here so the badge/type is ready once it does.
const TRIGGER_META: Record<
  AutofixTrigger,
  {
    Icon: typeof IconUser;
    description: string;
    label: string;
  }
> = {
  manual: {
    Icon: IconUser,
    label: t('Manual'),
    description: t(
      'A user kicked off this Autofix run from the issue details page, an API call, or Slack.'
    ),
  },
  issue_summary: {
    Icon: IconSeer,
    label: t('Issue summary'),
    description: t(
      'Auto-started from the issue summary on the issue details page when the issue looked fixable.'
    ),
  },
  alert: {
    Icon: IconSiren,
    label: t('Alert'),
    description: t('Auto-started when an alert rule for this issue fired.'),
  },
  post_process: {
    Icon: IconBroadcast,
    label: t('Post-process'),
    description: t('Auto-started when new events arrived for this issue.'),
  },
  night_shift: {
    Icon: IconBot,
    label: t('Workflow'),
    description: t('Triggered by the Sentry Workflows night-shift agentic triage run.'),
  },
};

/**
 * Map a SeerRun.source value onto a known trigger. Sources come from
 * SeerAgentRunSource (src/sentry/seer/models/run.py); anything unmapped
 * (bug-fixer, dashboard_generate, future values) returns null and renders the
 * raw-source fallback badge instead.
 */
export function mapRunSourceToTrigger(source: string | null): AutofixTrigger | null {
  switch (source) {
    case 'autofix':
    case 'slack_thread':
    case 'chat':
      return 'manual';
    case 'night_shift':
      return 'night_shift';
    default:
      return null;
  }
}

export function TriggerBadge({
  trigger,
  rawSource,
}: {
  rawSource?: string | null;
  trigger?: AutofixTrigger | null;
}) {
  if (!trigger) {
    if (!rawSource) {
      return null;
    }
    // Unknown source: show it verbatim rather than guessing a bucket.
    return (
      <Tooltip title={t('Triggered by %s.', rawSource)} skipWrapper>
        <Flex gap="xs" align="center">
          <IconSeer size="xs" variant="muted" aria-hidden />
          <Text size="sm">{rawSource}</Text>
        </Flex>
      </Tooltip>
    );
  }

  const meta = TRIGGER_META[trigger];
  return (
    <Tooltip title={meta.description} skipWrapper>
      <Flex gap="xs" align="center">
        <meta.Icon size="xs" variant="muted" aria-hidden />
        <Text size="sm">{meta.label}</Text>
      </Flex>
    </Tooltip>
  );
}
