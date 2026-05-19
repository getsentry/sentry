import {Tag} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {
  SnapshotApprovalStatus,
  SnapshotComparisonState,
} from 'sentry/views/preprod/types/buildDetailsTypes';

interface SnapshotStatusBadgeProps {
  approvalStatus: SnapshotApprovalStatus | null | undefined;
  comparisonState: SnapshotComparisonState | null | undefined;
  errorMessage: string | null | undefined;
}

export function SnapshotStatusBadge({
  comparisonState,
  approvalStatus,
  errorMessage,
}: SnapshotStatusBadgeProps) {
  if (!comparisonState) {
    return <Tag variant="info">{t('Base')}</Tag>;
  }
  if (comparisonState === 'waiting_for_base') {
    return (
      <Tooltip
        title={t(
          "Base snapshots haven't been uploaded yet. This will resolve automatically within ~10 minutes or fail."
        )}
      >
        <Tag variant="muted">{t('Waiting for base')}</Tag>
      </Tooltip>
    );
  }
  if (comparisonState === 'no_base_build') {
    return (
      <Tooltip title={t('No base snapshot was found for comparison.')}>
        <Tag variant="danger">{t('No base build')}</Tag>
      </Tooltip>
    );
  }
  if (comparisonState === 'pending') {
    return (
      <Tooltip title={t('Waiting to start comparison')}>
        <Tag variant="muted">{t('Pending')}</Tag>
      </Tooltip>
    );
  }
  if (comparisonState === 'processing') {
    return (
      <Tooltip title={t('Comparing against base snapshot')}>
        <Tag variant="muted">{t('Processing')}</Tag>
      </Tooltip>
    );
  }
  if (comparisonState === 'failed') {
    return (
      <Tooltip title={errorMessage || t('Comparison failed')}>
        <Tag variant="danger">{t('Failed')}</Tag>
      </Tooltip>
    );
  }
  if (approvalStatus === 'approved') {
    return <Tag variant="success">{t('Approved')}</Tag>;
  }
  if (approvalStatus === 'auto_approved') {
    return <Tag variant="success">{t('Auto Approved')}</Tag>;
  }
  if (approvalStatus === 'requires_approval') {
    return <Tag variant="warning">{t('Needs Approval')}</Tag>;
  }
  return <Text variant="muted">{'–'}</Text>;
}
