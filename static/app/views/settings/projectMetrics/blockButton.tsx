import type {BaseButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Tooltip} from 'sentry/components/tooltip';
import {IconNot, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';

type BlockTarget = 'metric' | 'tag';

export interface BlockButtonProps extends BaseButtonProps {
  blockTarget: BlockTarget;
  hasAccess: boolean;
  isBlocked: boolean;
  onConfirm: () => void;
}

const tooltipText: Record<BlockTarget, string> = {
  metric: t(
    'Disabling a metric blocks its ingestion and makes it inaccessible in Metrics, Alerts, and Dashboards.'
  ),
  tag: t(
    'Disabling a tag blocks its ingestion and makes it inaccessible in Metrics, Alerts, and Dashboards.'
  ),
};

const blockConfirmText: Record<BlockTarget, string> = {
  metric: t(
    'Are you sure you want to disable this metric? It will no longer be ingested, and will not be available for use in Metrics, Alerts, or Dashboards.'
  ),
  tag: t(
    'Are you sure you want to disable this tag? It will no longer be ingested, and will not be available for use in Metrics, Alerts, or Dashboards.'
  ),
};

const unblockConfirmText: Record<BlockTarget, string> = {
  metric: t('Are you sure you want to activate this metric?'),
  tag: t('Are you sure you want to activate this tag?'),
};

const blockAriaLabel: Record<BlockTarget, string> = {
  metric: t('Disable metric'),
  tag: t('Disable tag'),
};

const unblockAriaLabel: Record<BlockTarget, string> = {
  metric: t('Activate metric'),
  tag: t('Activate tag'),
};

export function BlockButton({
  isBlocked,
  blockTarget,
  onConfirm,
  hasAccess,
  disabled,
  ...props
}: BlockButtonProps) {
  const button = (
    <Confirm
      priority="danger"
      onConfirm={onConfirm}
      message={
        isBlocked ? unblockConfirmText[blockTarget] : blockConfirmText[blockTarget]
      }
      // Confirm clones the child element and adds the disabled prop to the clone
      // this will override the disabled prop if passed to the Button itself
      disabled={!hasAccess || disabled}
      confirmText={isBlocked ? t('Activate') : t('Disable')}
    >
      <Button
        {...props}
        aria-label={
          isBlocked ? unblockAriaLabel[blockTarget] : blockAriaLabel[blockTarget]
        }
        icon={isBlocked ? <IconPlay size="xs" /> : <IconNot size="xs" />}
      >
        {isBlocked ? t('Activate') : t('Disable')}
      </Button>
    </Confirm>
  );

  const hasTooltip = !hasAccess || !isBlocked;

  return hasTooltip ? (
    <Tooltip
      title={
        hasAccess
          ? tooltipText[blockTarget]
          : t('You do not have permissions to edit metrics.')
      }
    >
      {button}
    </Tooltip>
  ) : (
    button
  );
}
