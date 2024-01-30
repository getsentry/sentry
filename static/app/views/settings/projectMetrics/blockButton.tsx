import type {BaseButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {IconNot, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';

export interface BlockButtonProps extends BaseButtonProps {
  isBlocked: boolean;
  onConfirm: () => void;
}

export function BlockMetricButton({isBlocked, onConfirm, ...props}: BlockButtonProps) {
  return (
    <Confirm
      priority="danger"
      onConfirm={onConfirm}
      confirmText={isBlocked ? t('Unblock Metric') : t('Block Metric')}
      message={
        isBlocked
          ? t('Are you sure you want to unblock this metric?')
          : t('Are you sure you want to block this metric?')
      }
    >
      <Button
        icon={isBlocked ? <IconPlay size="xs" /> : <IconNot size="xs" />}
        {...props}
      >
        {isBlocked ? t('Unblock') : t('Block')}
      </Button>
    </Confirm>
  );
}
