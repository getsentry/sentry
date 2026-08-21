import {Badge} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import type {InvestigationOrchestrationSummary} from 'sentry/views/investigations/types';

type Props = {
  orchestration: InvestigationOrchestrationSummary;
};

export function CompactInvestigationOrchestrationStatus({orchestration}: Props) {
  return (
    <Badge variant={getStatusVariant(orchestration.status)}>
      {t(
        '%s · %s',
        formatStatus(orchestration.phase),
        formatStatus(orchestration.status)
      )}
    </Badge>
  );
}

export function isInvestigationOrchestrationSummaryActive(
  orchestration: InvestigationOrchestrationSummary | null | undefined
) {
  return (
    orchestration !== null &&
    orchestration !== undefined &&
    !['completed', 'failed', 'cancelled'].includes(orchestration.status)
  );
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}

function getStatusVariant(status: string): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'completed') {
    return 'success';
  }
  if (['failed', 'cancelled'].includes(status)) {
    return 'danger';
  }
  if (['awaiting_input', 'blocked', 'reauth_required', 'stalled'].includes(status)) {
    return 'warning';
  }
  if (['pending', 'processing', 'queued', 'running'].includes(status)) {
    return 'info';
  }
  return 'muted';
}
