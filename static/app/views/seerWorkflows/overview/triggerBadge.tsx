import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconBot, IconBroadcast, IconSeer, IconSiren, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {AutofixTrigger} from './types';

// Maps to `AutofixData.request.options.auto_run_source` on the backend
// (see src/sentry/seer/autofix/issue_summary.py):
//   manual         <- null / absent (user-initiated or Slack referrer)
//   issue_summary  <- issue_summary_fixability
//   alert          <- issue_summary_on_alert_fixability
//   post_process   <- issue_summary_on_post_process_fixability
//   night_shift    <- night_shift (Sentry Workflows cron)
export const TRIGGER_META: Record<
  AutofixTrigger,
  {
    Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
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

export function TriggerBadge({trigger}: {trigger: AutofixTrigger}) {
  const meta = TRIGGER_META[trigger];
  return (
    <Tooltip title={meta.description} skipWrapper>
      <Flex gap="xs" align="center">
        <Text variant="muted" aria-hidden>
          <meta.Icon size="xs" />
        </Text>
        <Text size="sm">{meta.label}</Text>
      </Flex>
    </Tooltip>
  );
}
