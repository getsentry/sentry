import {BaseButtonProps, Button} from 'sentry/components/button';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Monitor} from 'sentry/views/monitors/types';

interface StatusToggleButtonProps extends BaseButtonProps {
  monitor: Monitor;
}

function StatusToggleButton({monitor, ...props}: StatusToggleButtonProps) {
  const {status} = monitor;
  const isDisabeld = status === 'disabled';

  const Icon = isDisabeld ? IconPlay : IconPause;

  const label = isDisabeld
    ? t('Reactive this monitor')
    : t('Disable this monitor and discard incoming check-ins');

  return <Button icon={<Icon />} aria-label={label} title={label} {...props} />;
}

export {StatusToggleButton};
