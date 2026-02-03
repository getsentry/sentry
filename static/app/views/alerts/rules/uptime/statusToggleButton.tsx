import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';

interface StatusToggleButtonProps extends Omit<ButtonProps, 'onClick'> {
  onToggleStatus: (opts: {enabled: boolean}) => Promise<void>;
  uptimeDetector: UptimeDetector;
}

export function StatusToggleButton({
  uptimeDetector: {enabled},
  onToggleStatus,
  ...props
}: StatusToggleButtonProps) {
  const Icon = enabled ? IconPause : IconPlay;

  const label = enabled
    ? t('Disable this uptime rule and stop performing checks')
    : t('Enable this uptime rule');

  return (
    <Button
      icon={<Icon />}
      aria-label={label}
      tooltipProps={{title: label}}
      onClick={async () => {
        await onToggleStatus({enabled: !enabled});
        // TODO(epurkhiser): We'll need a hook here to trigger subscription
        // refresh in getsentry when toggling uptime monitors since it will
        // consume quota.
      }}
      {...props}
    />
  );
}
