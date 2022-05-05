import ActionButton from 'sentry/components/actions/button';
import {IconBell} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Group} from 'sentry/types';

import {getSubscriptionReason} from '../utils';

type Props = {
  group: Group;
  onClick: (event: React.MouseEvent) => void;
  disabled?: boolean;
};

function SubscribeAction({disabled, group, onClick}: Props) {
  const disabledNotifications = group.subscriptionDetails?.disabled ?? false;

  return (
    <ActionButton
      disabled={disabled || disabledNotifications}
      title={getSubscriptionReason(group, true)}
      tooltipProps={{delay: 300}}
      priority={group.isSubscribed ? 'primary' : 'default'}
      size="xsmall"
      aria-label={t('Subscribe')}
      onClick={onClick}
      icon={<IconBell size="xs" />}
    />
  );
}

export default SubscribeAction;
