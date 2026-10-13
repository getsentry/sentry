import {Fragment} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconCommit} from '@sentry/icons/commit';
import {IconPullRequest} from '@sentry/icons/pullRequest';
import {IconTimer} from '@sentry/icons/timer';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import type {
  EntityHeaderProps,
  EntityHeaderTitleProps,
} from '@sentry/scraps/entityHeader';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SnapshotStatusBadge} from 'sentry/components/preprod/snapshotStatusBadge';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {isSnapshotApproved} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {
  SnapshotApprover,
  SnapshotDetailsApiResponse,
} from 'sentry/views/preprod/types/snapshotTypes';
import {getBranchUrl, getPrUrl, getShaUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

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
    const tooltip = approvalTooltip(data.approvers ?? [], isAutoApproved);
    const tag = (
      <Tag variant="success" icon={<IconCheckmark />}>
        {isAutoApproved ? t('Auto-approved') : t('Approved')}
      </Tag>
    );

    return tooltip ? <Tooltip title={tooltip}>{tag}</Tooltip> : tag;
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
  const branch = data.vcs_info.head_ref;
  const branchUrl = getBranchUrl(data.vcs_info, branch);
  const tags = [approvalTag(data)];

  if (!branch) {
    // Without a commit comparison there is no branch, sha or PR at all, so the
    // app is the only thing left that names this build.
    return {
      type: 'text',
      label: data.app_id ? t('App') : t('Snapshot'),
      value: data.app_id || t('Unknown snapshot'),
      tags,
    };
  }

  const title = {label: t('Branch'), value: branch, tags};

  return branchUrl
    ? {...title, type: 'link', externalHref: branchUrl}
    : {...title, type: 'text'};
}

function buildMetadata(data: SnapshotDetailsApiResponse): EntityHeaderProps['metadata'] {
  const {vcs_info: vcsInfo} = data;
  const prUrl = getPrUrl(vcsInfo);
  const shaUrl = getShaUrl(vcsInfo, vcsInfo.head_sha);
  const shortSha = vcsInfo.head_sha?.slice(0, 7);

  return {
    label: t('Snapshot build'),
    items: [
      vcsInfo.pr_number && prUrl
        ? {
            type: 'link',
            label: t('Pull request'),
            value: `#${vcsInfo.pr_number}`,
            externalHref: prUrl,
            leadingGraphic: <IconPullRequest size="md" />,
          }
        : null,
      shortSha && shaUrl
        ? {
            type: 'link',
            label: t('Commit'),
            value: shortSha,
            externalHref: shaUrl,
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
        title={{type: 'text', label: t('Branch'), value: t('Snapshot')}}
        metadata={{label: t('Snapshot build'), items: [null, null]}}
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
