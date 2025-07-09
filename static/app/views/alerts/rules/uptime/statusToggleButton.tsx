import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ObjectStatus} from 'sentry/types/core';

import type {UptimeRule} from './types';

interface StatusToggleButtonProps extends Omit<ButtonProps, 'onClick'> {
  onToggleStatus: (status: ObjectStatus) => Promise<void>;
  uptimeRule: UptimeRule;
}

export function StatusToggleButton({
  uptimeRule,
  onToggleStatus,
  ...props
}: StatusToggleButtonProps) {
  const {status} = uptimeRule;
  const isDisabled = status === 'disabled';

  const Icon = isDisabled ? IconPlay : IconPause;

  const label = isDisabled
    ? t('Enable this uptime rule')
    : t('Disable this uptime rule and stop performing checks');

  return (
    <Button
      icon={<Icon redesign redesign redesign redesign />}
      aria-label={label}
      title={label}
      onClick={async () => {
        await onToggleStatus(isDisabled ? 'active' : 'disabled');
        // TODO(epurkhiser): We'll need a hook here to trigger subscription
        // refesh in getsentry when toggling uptime monitors since it will
        // consume quota.
      }}
      {...props}
    />
  );
}
