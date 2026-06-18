import {Badge} from '@sentry/scraps/badge';
import {Grid} from '@sentry/scraps/layout';

import {IconMerge, IconPullRequest, IconPullRequestClosed} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {PullRequestStatus} from 'sentry/types/integrations';

type PullRequestStatusConfig = {
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
} satisfies Record<PullRequestStatus, PullRequestStatusConfig>;

export function getPullRequestStatusLabel(status: PullRequestStatus) {
  return STATUS_CONFIG[status].label();
}

export function PullRequestStatusBadge({status}: {status: PullRequestStatus}) {
  const {icon: StatusIcon, variant} = STATUS_CONFIG[status];
  const statusLabel = getPullRequestStatusLabel(status);

  return (
    <Badge aria-label={t('Pull request status: %s', statusLabel)} variant={variant}>
      <Grid as="span" align="center" columns="max-content max-content" gap="2xs">
        <StatusIcon aria-hidden size="xs" />
        {statusLabel}
      </Grid>
    </Badge>
  );
}
