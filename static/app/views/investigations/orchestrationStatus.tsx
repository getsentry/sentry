import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import type {InvestigationOrchestrationSummary} from 'sentry/views/investigations/types';

type Props = {
  orchestration: InvestigationOrchestrationSummary;
};

const StatusBadge = styled(Badge)`
  width: max-content;
  max-width: 100%;
  justify-self: start;
`;

export function CompactInvestigationOrchestrationStatus({orchestration}: Props) {
  return (
    <StatusBadge variant={getStatusVariant(orchestration.status)}>
      {getStatusLabel(orchestration)}
    </StatusBadge>
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

function getStatusLabel(orchestration: InvestigationOrchestrationSummary) {
  if (orchestration.status === 'completed') {
    return t('Complete');
  }
  if (orchestration.status === 'failed') {
    return t('Failed');
  }
  if (orchestration.status === 'cancelled') {
    return t('Cancelled');
  }
  if (orchestration.status === 'awaiting_input') {
    return t('Needs a prompt');
  }
  if (orchestration.status === 'reauth_required') {
    return t('Reconnect required');
  }
  if (orchestration.status === 'stalled') {
    return t('Stalled');
  }
  if (orchestration.status === 'blocked') {
    return t('Blocked');
  }

  switch (orchestration.phase) {
    case 'intake':
      return t('Getting started');
    case 'broad_scan':
    case 'planning':
      return t('Finding causes');
    case 'investigating':
      return t('Testing hypotheses');
    case 'judging':
      return t('Reviewing findings');
    case 'reporting':
      return t('Building report');
    case 'metadata':
      return t('Finishing up');
    default:
      return t('In progress');
  }
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
