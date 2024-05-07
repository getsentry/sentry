import type {BaseButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {ObjectStatus} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';
import type {Monitor} from 'sentry/views/monitors/types';

interface StatusToggleButtonProps extends Omit<BaseButtonProps, 'onClick'> {
  monitor: Monitor;
  onToggleStatus: (status: ObjectStatus) => Promise<void>;
}

function SimpleStatusToggle({
  monitor,
  onToggleStatus,
  ...props
}: StatusToggleButtonProps) {
  const organization = useOrganization();
  const {status} = monitor;
  const isDisabled = status === 'disabled';
  const monitorCreationCallbacks = HookStore.get('callback:on-monitor-created');

  const Icon = isDisabled ? IconPlay : IconPause;

  const label = isDisabled
    ? t('Enable this monitor')
    : t('Disable this monitor and discard incoming check-ins');

  return (
    <Button
      icon={<Icon />}
      aria-label={label}
      title={label}
      onClick={async () => {
        await onToggleStatus(isDisabled ? 'active' : 'disabled');
        // TODO(davidenwang): Lets place this in the monitor-status-toggle hook once its created
        monitorCreationCallbacks.map(cb => cb(organization));
      }}
      {...props}
    />
  );
}

const StatusToggleButton = HookOrDefault({
  hookName: 'component:monitor-status-toggle',
  defaultComponent: SimpleStatusToggle,
});

export type {StatusToggleButtonProps};
export {StatusToggleButton};
