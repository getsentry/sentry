import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {IconBranch} from '@sentry/icons/branch';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconCommit} from '@sentry/icons/commit';
import {IconPullRequest} from '@sentry/icons/pullRequest';
import {IconTimer} from '@sentry/icons/timer';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import type {
  EntityHeaderMetadataItemProps,
  EntityHeaderProps,
  EntityHeaderTitleProps,
} from '@sentry/scraps/entityHeader';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SnapshotStatusBadge} from 'sentry/components/preprod/snapshotStatusBadge';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {isSnapshotApproved} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {BuildDetailsVcsInfo} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {
  SnapshotApprover,
  SnapshotDetailsApiResponse,
} from 'sentry/views/preprod/types/snapshotTypes';
import {getPrUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

const AUTO_APPROVED_EXPLANATION = t(
  'Automatically approved because the changes match a previously approved build on this PR.'
);

interface SnapshotEntityHeaderProps {
  data: SnapshotDetailsApiResponse | undefined;
  isLoading?: boolean;
}

function approverName(approver: SnapshotApprover) {
  return approver.name || approver.username || approver.email || t('Unknown user');
}

function approvalTooltip(approvers: SnapshotApprover[], isAutoApproved: boolean) {
  if (approvers.length === 0) {
    return isAutoApproved ? AUTO_APPROVED_EXPLANATION : null;
  }

  return (
    <Fragment>
      <Tooltip.Header>{t('Approved by')}</Tooltip.Header>
      <Tooltip.Grid columns="1fr max-content">
        {approvers.map((approver, index) => (
          <Tooltip.Row
            key={index}
            trailingItems={
              approver.approved_at ? <TimeSince date={approver.approved_at} /> : undefined
            }
          >
            {approverName(approver)}
          </Tooltip.Row>
        ))}
      </Tooltip.Grid>
      {isAutoApproved && <Tooltip.Footer>{AUTO_APPROVED_EXPLANATION}</Tooltip.Footer>}
    </Fragment>
  );
}

function approvalTag(data: SnapshotDetailsApiResponse) {
  const {approval_status: approvalStatus, comparison_state: comparisonState} = data;

  if (comparisonState !== 'success') {
    return (
      <SnapshotStatusBadge
        comparisonState={comparisonState}
        approvalStatus={approvalStatus}
        errorMessage={data.comparison_error_message}
      />
    );
  }

  if (isSnapshotApproved(approvalStatus)) {
    const isAutoApproved = approvalStatus === 'auto_approved';
    const approvers = data.approvers ?? [];
    const tooltip = approvalTooltip(approvers, isAutoApproved);
    const tag = (
      <Tag variant="success" icon={<IconCheckmark />}>
        {isAutoApproved ? t('Auto-approved') : t('Approved')}
      </Tag>
    );

    if (!tooltip) {
      return tag;
    }

    return (
      <Fragment>
        <Tooltip title={tooltip}>{tag}</Tooltip>
        {/*
          A Tag is not focusable, so the tooltip above is reachable by pointer
          only — its content is not in the DOM until it opens.
        */}
        {approvers.length > 0 && (
          <VisuallyHidden>
            {t('Approved by %s', approvers.map(approverName).join(', '))}
          </VisuallyHidden>
        )}
      </Fragment>
    );
  }

  if (approvalStatus === 'requires_approval') {
    return (
      <Tag variant="warning" icon={<IconTimer />}>
        {t('Needs approval')}
      </Tag>
    );
  }

  return null;
}

function buildTitle(data: SnapshotDetailsApiResponse): EntityHeaderTitleProps {
  return {
    type: 'text',
    label: t('App'),
    // Required by the snapshot upload endpoint, but nullable everywhere it is
    // typed. The fallback matches the one the GitHub check renders.
    value: data.app_id || t('Unknown App'),
    tags: [approvalTag(data)],
  };
}

function pullRequestItem(
  vcsInfo: BuildDetailsVcsInfo
): EntityHeaderMetadataItemProps | null {
  if (!vcsInfo.pr_number) {
    return null;
  }

  const item = {
    label: t('Pull request'),
    value: `#${vcsInfo.pr_number}`,
    leadingGraphic: <IconPullRequest size="md" />,
  };
  const prUrl = getPrUrl(vcsInfo);

  return prUrl ? {...item, type: 'link', externalHref: prUrl} : {...item, type: 'text'};
}

function buildMetadata(data: SnapshotDetailsApiResponse): EntityHeaderProps['metadata'] {
  const {vcs_info: vcsInfo} = data;
  const shortSha = vcsInfo.head_sha?.slice(0, 7);

  return {
    label: t('Snapshot build'),
    items: [
      pullRequestItem(vcsInfo),
      vcsInfo.head_ref
        ? {
            type: 'text',
            label: t('Branch'),
            value: vcsInfo.head_ref,
            leadingGraphic: <IconBranch size="md" />,
          }
        : null,
      shortSha
        ? {
            type: 'text',
            label: t('Commit'),
            value: shortSha,
            leadingGraphic: <IconCommit size="md" />,
          }
        : null,
    ],
  };
}

export function SnapshotEntityHeader({data, isLoading}: SnapshotEntityHeaderProps) {
  if (!data) {
    return (
      <EntityHeader
        isLoading
        title={{type: 'text', label: t('App'), value: t('Unknown App')}}
        metadata={{label: t('Snapshot build'), items: [null, null, null]}}
      />
    );
  }

  return (
    <EntityHeader
      isLoading={isLoading}
      title={buildTitle(data)}
      metadata={buildMetadata(data)}
    />
  );
}
