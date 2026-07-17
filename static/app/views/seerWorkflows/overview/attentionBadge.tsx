import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {LinkButton} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconCode, IconCommit, IconPullRequest, IconRefresh, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {AttentionReason, OverviewRow} from './types';

type LinkButtonVariant = React.ComponentProps<typeof LinkButton>['variant'];

export const ATTENTION_REASONS: AttentionReason[] = [
  'awaiting_input',
  'review_pr',
  'code_changes_ready',
  'solution_ready',
  'errored',
];

export const ATTENTION_META: Record<
  AttentionReason,
  {
    Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
    description: string;
    label: string;
    variant: LinkButtonVariant;
  }
> = {
  awaiting_input: {
    Icon: IconUser,
    label: t('Add context'),
    variant: 'primary',
    description: t(
      'Autofix paused and is asking for more information before it can proceed.'
    ),
  },
  review_pr: {
    Icon: IconPullRequest,
    label: t('Review PR'),
    variant: 'warning',
    description: t('Autofix opened a pull request. Review and merge it.'),
  },
  code_changes_ready: {
    Icon: IconCommit,
    label: t('Open PR'),
    variant: 'secondary',
    description: t('Autofix wrote a diff. Review it and open a pull request.'),
  },
  solution_ready: {
    Icon: IconCode,
    label: t('Generate code'),
    variant: 'secondary',
    description: t(
      'Autofix proposed a fix. Continue the pipeline to generate code changes.'
    ),
  },
  errored: {
    Icon: IconRefresh,
    label: t('Retry'),
    variant: 'secondary',
    description: t('Autofix run errored. Open it to investigate or retry.'),
  },
};

export function getAttentionReason(row: OverviewRow): AttentionReason | null {
  // A run that's still working has nothing actionable yet.
  if (row.isProcessing) {
    return null;
  }
  if (row.autofixRunStatus === 'NEED_MORE_INFORMATION') {
    return 'awaiting_input';
  }
  if (row.autofixRunStatus === 'ERROR') {
    return 'errored';
  }
  const set = new Set(row.outcomes);
  // A merged PR needs nothing further; when merge state is unknown (the
  // deployed API doesn't return it yet) an opened PR reads as needing review.
  if (row.prMerged) {
    return null;
  }
  if (set.has('pr_opened')) {
    return 'review_pr';
  }
  if (set.has('code_changes')) {
    return 'code_changes_ready';
  }
  if (set.has('solution')) {
    return 'solution_ready';
  }
  return null;
}

// Actionable tiers ordered by urgency-to-a-human: blocked-on-you first, then
// nearest-to-shipping, with the low-confidence retry last.
const ATTENTION_TRIAGE_RANK: Record<AttentionReason, number> = {
  awaiting_input: 0,
  review_pr: 1,
  code_changes_ready: 2,
  solution_ready: 3,
  errored: 4,
};

/**
 * Queue position for the overview's triage sort: everything a human can act on
 * (ranked by urgency), then rows whose state is still loading (parked in the
 * middle so they don't leap from the top when they resolve), then Seer-is-
 * working, then diagnosed-only, with merged wins sinking to the bottom as an
 * archive shelf. Lower sorts first.
 */
export function getTriageRank(row: OverviewRow, attention: AttentionReason | null) {
  if (attention !== null) {
    return ATTENTION_TRIAGE_RANK[attention];
  }
  if (row.statePending) {
    return 5;
  }
  if (row.isProcessing) {
    return 6;
  }
  if (row.prMerged) {
    return 8;
  }
  // Diagnosed-only: informational, optional next step.
  return 7;
}

const AccentLinkButton = styled(LinkButton)`
  background: ${p => p.theme.tokens.background.accent};
  border-color: ${p => p.theme.tokens.border.accent};
  color: ${p => p.theme.tokens.content.accent};
  &:hover {
    color: ${p => p.theme.tokens.content.accent};
  }
`;

const SuccessLinkButton = styled(LinkButton)`
  background: ${p => p.theme.tokens.background.success};
  border-color: ${p => p.theme.tokens.border.success};
  color: ${p => p.theme.tokens.content.success};
  &:hover {
    color: ${p => p.theme.tokens.content.success};
  }
`;

const MutedLinkButton = styled(LinkButton)`
  background: transparent;
  border-color: ${p => p.theme.tokens.border.neutral};
  color: ${p => p.theme.tokens.content.secondary};
`;

export function AttentionBadge({
  reason,
  to,
}: {
  reason: AttentionReason;
  to: LocationDescriptor;
}) {
  const meta = ATTENTION_META[reason];

  if (reason === 'code_changes_ready') {
    return (
      <Tooltip title={meta.description} skipWrapper>
        <AccentLinkButton size="zero" icon={<meta.Icon />} to={to}>
          {meta.label}
        </AccentLinkButton>
      </Tooltip>
    );
  }
  if (reason === 'solution_ready') {
    return (
      <Tooltip title={meta.description} skipWrapper>
        <SuccessLinkButton size="zero" icon={<meta.Icon />} to={to}>
          {meta.label}
        </SuccessLinkButton>
      </Tooltip>
    );
  }
  if (reason === 'errored') {
    return (
      <Tooltip title={meta.description} skipWrapper>
        <MutedLinkButton size="zero" icon={<meta.Icon />} to={to}>
          {meta.label}
        </MutedLinkButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={meta.description} skipWrapper>
      <LinkButton size="zero" variant={meta.variant} icon={<meta.Icon />} to={to}>
        {meta.label}
      </LinkButton>
    </Tooltip>
  );
}
