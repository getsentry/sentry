import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  BuildDetailsApiResponse,
  SnapshotApprovalStatus,
  SnapshotComparisonState,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getSnapshotPath} from 'sentry/views/preprod/utils/buildLinkUtils';

import {FullRowLink} from './preprodBuildsTableCommon';

interface PreprodBuildsSnapshotTableProps {
  builds: BuildDetailsApiResponse[];
  organizationSlug: string;
  showProjectColumn: boolean;
  content?: ReactNode;
  onRowClick?: (build: BuildDetailsApiResponse) => void;
}

function ApprovalBadge({
  comparisonState,
  approvalStatus,
  errorMessage,
}: {
  approvalStatus: SnapshotApprovalStatus | null | undefined;
  comparisonState: SnapshotComparisonState | null | undefined;
  errorMessage: string | null | undefined;
}) {
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

function ChangeCounts({
  added,
  removed,
  changed,
  unchanged,
  comparisonState,
}: {
  added: number;
  changed: number;
  comparisonState: SnapshotComparisonState | null | undefined;
  removed: number;
  unchanged: number;
}) {
  if (comparisonState !== 'success') {
    return <Text variant="muted">{'–'}</Text>;
  }
  if (added === 0 && removed === 0 && changed === 0) {
    return (
      <Text size="sm" variant="muted">
        {t('No changes')}
      </Text>
    );
  }
  const parts: string[] = [];
  if (added > 0) {
    parts.push(t('%s added', added));
  }
  if (removed > 0) {
    parts.push(t('%s removed', removed));
  }
  if (changed > 0) {
    parts.push(t('%s changed', changed));
  }
  if (unchanged > 0) {
    parts.push(t('%s unchanged', unchanged));
  }
  return (
    <Text size="sm" variant="muted">
      {parts.join(', ')}
    </Text>
  );
}

export function PreprodBuildsSnapshotTable({
  builds,
  content,
  onRowClick,
  organizationSlug,
  showProjectColumn,
}: PreprodBuildsSnapshotTableProps) {
  const rows = builds.map(build => {
    const linkUrl = getSnapshotPath({
      organizationSlug,
      snapshotId: build.id,
    });
    const info = build.snapshot_comparison_info;
    const appId = build.app_info?.app_id;
    return (
      <SimpleTable.Row key={build.id}>
        <FullRowLink to={linkUrl} onClick={() => onRowClick?.(build)}>
          <InteractionStateLayer />
          <SimpleTable.RowCell justify="start">
            <Flex direction="column" gap="2xs">
              <Text bold>{appId || t('Snapshot')}</Text>
              <Text size="sm" variant="muted">
                {t('%s images', info?.image_count ?? 0)}
              </Text>
            </Flex>
          </SimpleTable.RowCell>
          {showProjectColumn && (
            <SimpleTable.RowCell justify="start">
              <Text>{build.project_slug}</Text>
            </SimpleTable.RowCell>
          )}
          <SimpleTable.RowCell>
            <ApprovalBadge
              comparisonState={info?.comparison_state}
              approvalStatus={info?.approval_status}
              errorMessage={info?.comparison_error_message}
            />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <ChangeCounts
              added={info?.images_added ?? 0}
              removed={info?.images_removed ?? 0}
              changed={info?.images_changed ?? 0}
              unchanged={info?.images_unchanged ?? 0}
              comparisonState={info?.comparison_state}
            />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="start">
            <Flex direction="column" gap="2xs">
              {build.vcs_info?.head_ref && (
                <Flex align="center" gap="xs">
                  <Text size="sm" bold>
                    {build.vcs_info.head_ref}
                  </Text>
                  {build.vcs_info?.pr_number && (
                    <Text size="sm" variant="muted">
                      #{build.vcs_info.pr_number}
                    </Text>
                  )}
                </Flex>
              )}
              <Flex align="center" gap="xs">
                <IconCommit size="xs" />
                <Text size="sm" variant="muted" monospace>
                  {(build.vcs_info?.head_sha?.slice(0, 7) || '–').toUpperCase()}
                </Text>
              </Flex>
            </Flex>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            {build.app_info?.date_added ? (
              <TimeSince date={build.app_info.date_added} unitStyle="short" />
            ) : (
              '–'
            )}
          </SimpleTable.RowCell>
        </FullRowLink>
      </SimpleTable.Row>
    );
  });

  return (
    <BuildsSnapshotTable showProjectColumn={showProjectColumn}>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Snapshot')}</SimpleTable.HeaderCell>
        {showProjectColumn && (
          <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
        )}
        <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Changes')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Branch')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {content ?? rows}
    </BuildsSnapshotTable>
  );
}

const snapshotTableColumns = {
  withProject: `minmax(200px, 2fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 140px)
    minmax(180px, 2fr) minmax(80px, 120px)`,
  withoutProject: `minmax(200px, 2fr) minmax(100px, 1fr) minmax(100px, 140px)
    minmax(180px, 2fr) minmax(80px, 120px)`,
};

const BuildsSnapshotTable = styled(SimpleTable)<{showProjectColumn?: boolean}>`
  overflow-x: auto;
  overflow-y: auto;
  grid-template-columns: ${p =>
    p.showProjectColumn
      ? snapshotTableColumns.withProject
      : snapshotTableColumns.withoutProject};
`;
