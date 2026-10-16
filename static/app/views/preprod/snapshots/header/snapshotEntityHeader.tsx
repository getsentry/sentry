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
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
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

function toAvatarUser(approver: SnapshotApprover, index: number): AvatarUser {
  return {
    // The backend dedupes approvers on a namespaced key but serialises the bare
    // id, so a Sentry user and a GitHub user can arrive sharing one. AvatarList
    // keys on this, and two people under one key render as one.
    id: approver.id ? `${approver.source}:${approver.id}` : `approver-${index}`,
    // `userDisplayName` reads `name` alone, so the fallbacks have to land there
    // or a GitHub approver carrying only a login reads as an unknown author.
    name: approverName(approver),
    email: approver.email ?? '',
    username: approver.username ?? '',
    ip_address: '',
    avatar: approver.avatar_url
      ? {avatarType: 'upload' as const, avatarUuid: '', avatarUrl: approver.avatar_url}
      : undefined,
  };
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
    const tag = (
      <Tag variant="success" icon={<IconCheckmark />}>
        {approvalStatus === 'auto_approved' ? t('Auto-approved') : t('Approved')}
      </Tag>
    );

    return approvalStatus === 'auto_approved' ? (
      <Tooltip title={AUTO_APPROVED_EXPLANATION}>{tag}</Tooltip>
    ) : (
      tag
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
      // Who approved is a fact about the build, not about the state it is in,
      // so it sits beside the status rather than inside it — and stays visible
      // whatever that status turns out to be.
      people={{label: t('Approved by'), users: (data.approvers ?? []).map(toAvatarUser)}}
    />
  );
}
