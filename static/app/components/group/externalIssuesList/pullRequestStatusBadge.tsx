import {Badge} from '@sentry/scraps/badge';
import {Grid} from '@sentry/scraps/layout';

import {
  IconCheckmark,
  IconClock,
  IconClose,
  IconMerge,
  IconPullRequest,
  IconPullRequestClosed,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {
  PullRequestChecksStatus,
  PullRequestReviewStatus,
  PullRequestStatus,
} from 'sentry/types/integrations';

type PullRequestBadgeConfig = {
  icon: React.ComponentType<SVGIconProps>;
  label: () => string;
  variant: React.ComponentProps<typeof Badge>['variant'];
};

const STATUS_CONFIG = {
  closed: {
    icon: IconPullRequestClosed,
    label: () => t('Closed'),
    variant: 'danger',
  },
  draft: {
    icon: IconPullRequest,
    label: () => t('Draft'),
    variant: 'muted',
  },
  merged: {
    icon: IconMerge,
    label: () => t('Merged'),
    variant: 'info',
  },
  open: {
    icon: IconPullRequest,
    label: () => t('Open'),
    variant: 'success',
  },
  unknown: {
    icon: IconPullRequest,
    label: () => t('Unknown'),
    variant: 'muted',
  },
} satisfies Record<PullRequestStatus, PullRequestBadgeConfig>;

const CHECKS_CONFIG = {
  failure: {
    icon: IconClose,
    label: () => t('Checks failed'),
    variant: 'danger',
  },
  pending: {
    icon: IconClock,
    label: () => t('Checks running'),
    variant: 'muted',
  },
  success: {
    icon: IconCheckmark,
    label: () => t('Checks passed'),
    variant: 'success',
  },
} satisfies Record<PullRequestChecksStatus, PullRequestBadgeConfig>;

const REVIEW_CONFIG = {
  approved: {
    icon: IconCheckmark,
    label: () => t('Approved'),
    variant: 'success',
  },
  changes_requested: {
    icon: IconClose,
    label: () => t('Changes requested'),
    variant: 'danger',
  },
  review_required: {
    icon: IconClock,
    label: () => t('Review required'),
    variant: 'muted',
  },
} satisfies Record<PullRequestReviewStatus, PullRequestBadgeConfig>;

function PullRequestBadge({
  ariaLabel,
  config,
}: {
  config: PullRequestBadgeConfig;
  ariaLabel?: string;
}) {
  const {icon: StatusIcon, label, variant} = config;

  return (
    <Badge aria-label={ariaLabel} variant={variant}>
      <Grid as="span" align="center" columns="max-content max-content" gap="2xs">
        <StatusIcon aria-hidden size="xs" />
        {label()}
      </Grid>
    </Badge>
  );
}

export function getPullRequestStatusLabel(status: PullRequestStatus) {
  return STATUS_CONFIG[status].label();
}

export function PullRequestStatusBadge({status}: {status: PullRequestStatus}) {
  const statusLabel = getPullRequestStatusLabel(status);

  return (
    <PullRequestBadge
      ariaLabel={t('Pull request status: %s', statusLabel)}
      config={STATUS_CONFIG[status]}
    />
  );
}

export function PullRequestChecksBadge({status}: {status: PullRequestChecksStatus}) {
  return <PullRequestBadge config={CHECKS_CONFIG[status]} />;
}

export function PullRequestReviewBadge({status}: {status: PullRequestReviewStatus}) {
  return <PullRequestBadge config={REVIEW_CONFIG[status]} />;
}
