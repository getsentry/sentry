import type {BaseButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Tooltip} from 'sentry/components/tooltip';
import {IconNot, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {OpenConfirmOptions} from '../../../components/confirm';

export interface BlockButtonProps
  extends BaseButtonProps,
    Pick<OpenConfirmOptions, 'message'> {
  hasAccess: boolean;
  isBlocked: boolean;
  onConfirm: () => void;
}

export function BlockButton({isBlocked, onConfirm, ...props}: BlockButtonProps) {
  const button = (
    <Button
      {...props}
      icon={isBlocked ? <IconPlay size="xs" /> : <IconNot size="xs" />}
      disabled={!props.hasAccess || props.disabled}
    >
      {isBlocked ? t('Unblock') : t('Block')}
    </Button>
  );

  return (
    <Confirm
      priority="danger"
      onConfirm={onConfirm}
      message={props.message}
      confirmText={isBlocked ? t('Unblock') : t('Block')}
    >
      {props.hasAccess ? (
        button
      ) : (
        <Tooltip title={t('You do not have permissions to edit metrics.')}>
          {button}
        </Tooltip>
      )}
    </Confirm>
  );
}
