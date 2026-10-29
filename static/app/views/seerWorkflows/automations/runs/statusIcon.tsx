import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconClose} from '@sentry/icons/close';
import {IconWarning} from '@sentry/icons/warning';

import {Spinner} from '@sentry/scraps/chat';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {
  SeerAutomationRunStatus,
  WorkflowDisplayStatus,
} from 'sentry/views/seerWorkflows/types';

const STATUS_VARIANT = {
  succeeded: {Icon: IconCheckmark, label: 'Succeeded', text: 'success'},
  failed: {Icon: IconClose, label: 'Failed', text: 'danger'},
  skipped: {Icon: IconWarning, label: 'Skipped', text: 'muted'},
  partial: {Icon: IconWarning, label: 'Incomplete', text: 'warning'},
} as const satisfies Record<
  Exclude<WorkflowDisplayStatus, 'running'>,
  {
    Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
    label: string;
    text: 'success' | 'danger' | 'muted' | 'warning';
  }
>;

/**
 * Null for historical runs recorded without a status
 */
export function getRunDisplayStatus(
  status: SeerAutomationRunStatus
): WorkflowDisplayStatus | null {
  switch (status) {
    case 'queued':
    case 'running':
      return 'running';
    case 'complete':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'rejected':
      return 'skipped';
    case null:
      return null;
  }
}

export function StatusIcon({status}: {status: WorkflowDisplayStatus}) {
  if (status === 'running') {
    return (
      <Tooltip title={t('Running')} skipWrapper>
        <Spinner role="status" aria-label={t('Running')} />
      </Tooltip>
    );
  }

  const {Icon, label, text} = STATUS_VARIANT[status];
  return (
    <Tooltip title={label} skipWrapper>
      <Icon aria-label={label} variant={text} size="sm" />
    </Tooltip>
  );
}
