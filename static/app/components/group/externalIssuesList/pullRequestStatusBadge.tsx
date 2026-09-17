import {Badge} from '@sentry/scraps/badge';
import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  IconCheckmark,
  IconCircle,
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

type PullRequestDetailConfig = {
  icon: React.ComponentType<SVGIconProps>;
  label: () => string;
  variant: SVGIconProps['variant'];
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
    icon: IconCircle,
    label: () => t('Checks running'),
    variant: 'warning',
  },
  success: {
    icon: IconCheckmark,
    label: () => t('Checks passed'),
    variant: 'success',
  },
} satisfies Record<PullRequestChecksStatus, PullRequestDetailConfig>;

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
    icon: IconCircle,
    label: () => t('Review required'),
    variant: 'warning',
  },
} satisfies Record<PullRequestReviewStatus, PullRequestDetailConfig>;

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

function PullRequestDetail({config}: {config: PullRequestDetailConfig}) {
  const {icon: StatusIcon, label, variant} = config;

  return (
    <Grid as="span" align="center" columns="max-content max-content" gap="xs">
      <StatusIcon aria-hidden size="xs" variant={variant} />
      <Text as="span" variant="muted" size="sm">
        {label()}
      </Text>
    </Grid>
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
  return <PullRequestDetail config={CHECKS_CONFIG[status]} />;
}

export function PullRequestReviewBadge({status}: {status: PullRequestReviewStatus}) {
  return <PullRequestDetail config={REVIEW_CONFIG[status]} />;
}
