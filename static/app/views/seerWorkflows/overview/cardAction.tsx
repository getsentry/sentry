import type {LocationDescriptor} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  IconCode,
  IconCommit,
  IconMerge,
  IconOpen,
  IconPullRequest,
  IconRefresh,
  IconSearch,
  IconUser,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

import type {AutofixStateKey, CardAction, OverviewRow} from './types';

type LinkButtonVariant = React.ComponentProps<typeof LinkButton>['variant'];

// Stage actions are keyed by section; the two extras (awaiting_input, errored)
// are the transient live-status overlays. Strings are translated product copy.
type ActionKey =
  | 'review_pr'
  | 'code_changes_ready'
  | 'solution_ready'
  | 'needs_investigation'
  | 'awaiting_input'
  | 'errored';

const ACTION_META: Record<
  ActionKey,
  {
    Icon: React.ComponentType<SVGIconProps>;
    description: string;
    label: string;
    variant: LinkButtonVariant;
  }
> = {
  review_pr: {
    Icon: IconPullRequest,
    label: t('Review PR'),
    variant: 'primary',
    description: t('Autofix opened a pull request. Review and merge it.'),
  },
  code_changes_ready: {
    Icon: IconCommit,
    label: t('Draft PR'),
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
  needs_investigation: {
    Icon: IconSearch,
    label: t('Approve Root Cause'),
    variant: 'secondary',
    description: t(
      'Seer stopped at a diagnosis. Review the root cause and approve it to continue.'
    ),
  },
  awaiting_input: {
    Icon: IconUser,
    label: t('Add context'),
    variant: 'primary',
    description: t(
      'Autofix paused and is asking for more information before it can proceed.'
    ),
  },
  errored: {
    Icon: IconRefresh,
    label: t('Retry'),
    variant: 'secondary',
    description: t('Autofix run errored. Open it to investigate or retry.'),
  },
};

export function deriveCardAction(
  sectionKey: AutofixStateKey,
  row: OverviewRow
): CardAction {
  if (sectionKey === 'review_pr') {
    return {type: 'review_pr', prUrl: row.prUrl, prNumber: row.prNumber};
  }
  return {type: sectionKey};
}

function ActionButton({
  actionKey,
  size,
  onClick,
  to,
}: {
  actionKey: ActionKey;
  onClick: (() => void) | undefined;
  size: 'sm' | 'xs';
  to: LocationDescriptor;
}) {
  const meta = ACTION_META[actionKey];
  return (
    <Tooltip title={meta.description} skipWrapper>
      {onClick ? (
        <Button size={size} variant={meta.variant} icon={<meta.Icon />} onClick={onClick}>
          {meta.label}
        </Button>
      ) : (
        <LinkButton size={size} variant={meta.variant} icon={<meta.Icon />} to={to}>
          {meta.label}
        </LinkButton>
      )}
    </Tooltip>
  );
}

function ReviewPrButton({
  prUrl,
  prNumber,
  size,
}: {
  prNumber: number | undefined;
  prUrl: string;
  size: 'sm' | 'xs';
}) {
  const meta = ACTION_META.review_pr;
  return (
    <Tooltip title={meta.description} skipWrapper>
      <LinkButton
        size={size}
        variant={meta.variant}
        icon={<meta.Icon />}
        href={prUrl}
        external
      >
        {/* The PR number breaks up a section of otherwise-identical buttons;
            the trailing IconOpen marks the jump out to the code host. The
            button only auto-spaces its leading icon slot, so the trailing
            icon needs its own flex gap. */}
        <Flex as="span" gap="xs" align="center">
          {prNumber ? t('Review PR #%s', prNumber) : meta.label}
          <IconOpen size="xs" />
        </Flex>
      </LinkButton>
    </Tooltip>
  );
}

/**
 * The card's primary action. The section (via `action`) is the anchor; the live
 * run status only paints transient overlays over it — the loading placeholder,
 * the Running tag, and the Retry / Add-context prompts for a paused or errored
 * run — none of which reclassify the card.
 */
export function IssuePrimaryAction({
  action,
  row,
  onOpenRun,
  runUrl,
  size = 'sm',
}: {
  action: CardAction;
  row: OverviewRow;
  runUrl: LocationDescriptor;
  onOpenRun?: () => void;
  size?: 'sm' | 'xs';
}) {
  if (row.statePending) {
    return <Text variant="muted">{'…'}</Text>;
  }
  if (row.runStatus === 'processing') {
    return <Tag variant="info">{t('Running')}</Tag>;
  }
  if (row.runStatus === 'error') {
    return (
      <ActionButton actionKey="errored" size={size} onClick={onOpenRun} to={runUrl} />
    );
  }
  if (row.runStatus === 'awaiting_user_input') {
    return (
      <ActionButton
        actionKey="awaiting_input"
        size={size}
        onClick={onOpenRun}
        to={runUrl}
      />
    );
  }

  switch (action.type) {
    case 'merged':
      return (
        <Tooltip title={t('The pull request for this fix was merged.')}>
          <Tag variant="success" icon={<IconMerge />}>
            {t('Merged')}
          </Tag>
        </Tooltip>
      );
    case 'review_pr':
      return action.prUrl ? (
        <ReviewPrButton prUrl={action.prUrl} prNumber={action.prNumber} size={size} />
      ) : (
        <ActionButton actionKey="review_pr" size={size} onClick={onOpenRun} to={runUrl} />
      );
    default:
      return (
        <ActionButton
          actionKey={action.type}
          size={size}
          onClick={onOpenRun}
          to={runUrl}
        />
      );
  }
}
