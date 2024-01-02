import {BaseButtonProps, Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ObjectStatus} from 'sentry/types';
import {Monitor} from 'sentry/views/monitors/types';

interface StatusToggleButtonProps extends Omit<BaseButtonProps, 'onClick'> {
  monitor: Monitor;
  onToggleStatus: (status: ObjectStatus) => void;
}

function SimpleStatusToggle({
  monitor,
  onToggleStatus,
  ...props
}: StatusToggleButtonProps) {
  const {status} = monitor;
  const isDisabeld = status === 'disabled';

  const Icon = isDisabeld ? IconPlay : IconPause;

  const label = isDisabeld
    ? t('Reactive this monitor')
    : t('Disable this monitor and discard incoming check-ins');

  return (
    <Button
      icon={<Icon />}
      aria-label={label}
      title={label}
      onClick={() => onToggleStatus(isDisabeld ? 'active' : 'disabled')}
      {...props}
    />
  );
}

const StatusToggleButton = HookOrDefault({
  hookName: 'component:monitor-status-toggle',
  defaultComponent: SimpleStatusToggle,
});

export {StatusToggleButton, StatusToggleButtonProps};
